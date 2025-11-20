import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  console.log(`[generate-pdf-report] ${req.method} request received`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: `Method ${req.method} not allowed. Use POST.` }),
      { 
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { report_type, start_date, end_date, group_name } = body;
    console.log(`[generate-pdf-report] Generating ${report_type} report${group_name ? ` for group: ${group_name}` : ""}`);
    
    if (!report_type) {
      return new Response(
        JSON.stringify({ error: "report_type is required" }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase configuration" }),
        { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { 
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "User not authenticated" }),
        { 
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get personality profile for tone
    const { data: profile } = await supabase
      .from("personality_profile")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const personalityProfile = profile || {
      tone_formal: 0.5,
      tone_direct: 0.5,
      tone_empathetic: 0.5,
      phrasing_examples: [],
      preferred_verbs: [],
      formatting_style: {},
    };

    // Build tone instruction
    const toneInstruction = buildToneInstruction(personalityProfile);

    let reportContent = "";
    let reportTitle = "";

    if (report_type === "group") {
      if (!group_name) {
        return new Response(
          JSON.stringify({ error: "group_name is required for group reports" }),
          { 
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      console.log(`Generating group report for: ${group_name}, user: ${user.id}`);
      
      // Get notes for a specific group
      let query = supabase
        .from("debtors_notes")
        .select("*, debtors_files(file_url)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (group_name === "Ungrouped" || group_name === "ungrouped") {
        query = query.is("group_name", null);
      } else {
        query = query.eq("group_name", group_name);
      }

      const { data: notes, error: notesError } = await query;
      
      if (notesError) {
        console.error("Error fetching notes:", notesError);
        return new Response(
          JSON.stringify({ error: `Failed to fetch notes: ${notesError.message}` }),
          { 
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log(`Found ${notes?.length || 0} notes for group: ${group_name}`);

      const displayGroupName = group_name === "Ungrouped" || group_name === "ungrouped" ? "Ungrouped" : group_name;
      reportTitle = `Group Report: ${displayGroupName}`;
      reportContent = generateGroupReport(notes || [], personalityProfile, displayGroupName);
      
      console.log(`Generated report content length: ${reportContent?.length || 0} characters`);
    } else if (report_type === "daily") {
      // Get approved notes from today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: notes } = await supabase
        .from("debtors_notes")
        .select("*, debtors_files(file_url)")
        .eq("user_id", user.id)
        .gte("created_at", today.toISOString())
        .lt("created_at", tomorrow.toISOString())
        .order("created_at", { ascending: false });

      reportTitle = `Daily Debtor Summary - ${today.toLocaleDateString()}`;
      reportContent = generateDailyReport(notes || [], personalityProfile);
    } else if (report_type === "weekly") {
      const end = end_date ? new Date(end_date) : new Date();
      const start = start_date
        ? new Date(start_date)
        : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

      const { data: notes } = await supabase
        .from("debtors_notes")
        .select("*, debtors_files(file_url)")
        .eq("user_id", user.id)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false });

      reportTitle = `Weekly Debtor Summary - ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`;
      reportContent = generateWeeklyReport(notes || [], personalityProfile);
    } else {
      return new Response(
        JSON.stringify({ error: `Invalid report_type: ${report_type}. Must be "daily", "weekly", or "group"` }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate that we have content
    if (!reportContent || reportContent.trim() === "") {
      return new Response(
        JSON.stringify({ error: `No report content generated for ${report_type} report${report_type === "group" && group_name ? ` (group: ${group_name})` : ""}. Please check your data.` }),
        { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get API keys (free APIs first) - only needed for AI-enhanced reports, not for group reports
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    // Priority: Lovable AI → Groq (free, fast) → Gemini (free) → OpenRouter (free tier) → OpenAI → Anthropic
    const apiKey = lovableApiKey || groqApiKey || geminiApiKey || openrouterApiKey || openaiApiKey || anthropicApiKey;
    const useLovable = !!lovableApiKey;
    const useGroq = !!groqApiKey && !lovableApiKey;
    const useGemini = !!geminiApiKey && !lovableApiKey && !groqApiKey;
    const useOpenRouter = !!openrouterApiKey && !lovableApiKey && !groqApiKey && !geminiApiKey;
    const useOpenAI = !!openaiApiKey && !lovableApiKey && !groqApiKey && !geminiApiKey && !openrouterApiKey;
    const useAnthropic = !!anthropicApiKey && !lovableApiKey && !groqApiKey && !geminiApiKey && !openrouterApiKey && !openaiApiKey;

    // API key only required for daily/weekly reports that might use AI
    // Group reports don't need AI
    if (!apiKey && report_type !== "group") {
      return new Response(
        JSON.stringify({ 
          error: "No AI API configured. Lovable AI is included in your subscription!"
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use the HTML content directly (already formatted with screenshots and proper styling)
    // The generateDailyReport and generateWeeklyReport functions now return HTML directly
    const pdfHtml = reportContent;

    // Save report to database
    const { data: report, error: reportError } = await supabase
      .from("reports")
      .insert({
        user_id: user.id,
        title: reportTitle,
        content: reportContent,
        pdf_url: null, // Could upload HTML to storage and generate PDF
      })
      .select()
      .single();

    if (reportError) {
      console.error("Error saving report:", reportError);
      // Don't throw - still return the PDF even if saving fails
    }

    return new Response(
      JSON.stringify({
        report_id: report?.id || null,
        title: reportTitle,
        content: reportContent,
        pdf_html: pdfHtml,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-pdf-report:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        ...(errorStack && { details: errorStack }),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function buildToneInstruction(profile: any): string {
  const formality = profile.tone_formal || 0.5;
  const directness = profile.tone_direct || 0.5;
  const empathy = profile.tone_empathetic || 0.5;

  let instruction = "Write with:\n";

  if (formality > 0.7) {
    instruction += "- Professional, formal tone\n";
  } else if (formality < 0.3) {
    instruction += "- Casual, conversational tone\n";
  } else {
    instruction += "- Balanced professional tone\n";
  }

  if (directness > 0.7) {
    instruction += "- Concise, direct statements\n";
  }

  if (empathy > 0.7) {
    instruction += "- Empathetic, understanding tone\n";
  }

  return instruction;
}

function generateDailyReport(notes: any[], profile: any): string {
  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      padding: 30px 40px; 
      line-height: 1.7; 
      background: #ffffff;
      color: #1a1a1a;
    }
    .header { 
      margin-bottom: 40px; 
      padding-bottom: 20px; 
      border-bottom: 3px solid #0066cc; 
    }
    h1 { 
      color: #0066cc; 
      font-size: 28px; 
      font-weight: 700; 
      margin-bottom: 10px;
      letter-spacing: -0.5px;
    }
    .report-meta {
      color: #666;
      font-size: 14px;
      margin-top: 5px;
    }
    .debtor-entry { 
      margin-bottom: 35px; 
      page-break-inside: avoid; 
      border: 2px solid #e0e0e0; 
      padding: 25px; 
      border-radius: 8px; 
      background: #fafafa;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      transition: all 0.3s ease;
    }
    .debtor-header { 
      font-size: 20px; 
      font-weight: 700; 
      color: #0066cc; 
      margin-bottom: 20px; 
      padding-bottom: 12px;
      border-bottom: 2px solid #e0e0e0;
    }
    .financial-details { 
      display: grid; 
      grid-template-columns: repeat(3, 1fr); 
      gap: 20px; 
      margin: 20px 0; 
    }
    .detail-item { 
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%); 
      padding: 18px; 
      border-radius: 6px; 
      border: 1px solid #e8e8e8;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .detail-label { 
      font-size: 11px; 
      color: #888; 
      margin-bottom: 8px; 
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }
    .detail-value { 
      font-size: 18px; 
      font-weight: 700; 
      color: #1a1a1a;
    }
    .detail-value.overdue { color: #d32f2f; }
    .detail-value.balance { color: #0066cc; }
    .summary { 
      margin: 20px 0; 
      padding: 18px 20px; 
      background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); 
      border-left: 4px solid #0066cc; 
      border-radius: 4px;
      font-size: 14px;
      line-height: 1.8;
      color: #333;
    }
    .summary strong {
      color: #0066cc;
      font-weight: 600;
    }
    .urgency { 
      display: inline-block; 
      padding: 8px 16px; 
      border-radius: 20px; 
      font-size: 12px; 
      font-weight: 600; 
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .urgency-high { background: #ffebee; color: #c62828; border: 1px solid #ef5350; }
    .urgency-medium { background: #fff3e0; color: #e65100; border: 1px solid #ff9800; }
    .urgency-low { background: #e8f5e9; color: #2e7d32; border: 1px solid #4caf50; }
    .urgency-urgent { background: #fce4ec; color: #880e4f; border: 1px solid #e91e63; }
    .screenshot-container {
      margin: 20px 0;
      padding: 15px;
      background: #ffffff;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      page-break-inside: avoid;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .screenshot {
      max-width: 100%; 
      height: auto; 
      border-radius: 6px;
      display: block;
      margin: 0 auto;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .screenshot-label {
      font-size: 11px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
      font-weight: 600;
    }
    @media print {
      .debtor-entry { page-break-inside: avoid; }
      body { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Daily Debtor Summary</h1>
    <div class="report-meta">
      <strong>Total Notes:</strong> ${notes.length} | 
      <strong>Generated:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
    </div>
  </div>
`;

  notes.forEach((note, index) => {
    // Handle different data structures from Supabase join
    let fileUrl: string | null = null;
    if (note.debtors_files) {
      if (Array.isArray(note.debtors_files) && note.debtors_files.length > 0) {
        fileUrl = note.debtors_files[0].file_url;
      } else if (typeof note.debtors_files === 'object' && note.debtors_files.file_url) {
        fileUrl = note.debtors_files.file_url;
      }
    }
    
    const urgencyClass = `urgency-${(note.urgency || "medium").toLowerCase()}`;
    const overdueClass = (note.overdue && note.overdue > 0) ? "overdue" : "";
    const balanceClass = "balance";
    
    html += `
    <div class="debtor-entry">
      <div class="debtor-header">${index + 1}. ${note.client_name || "Unknown Client"}</div>
      ${fileUrl ? `
      <div class="screenshot-container">
        <div class="screenshot-label">Original Screenshot</div>
        <img src="${fileUrl}" alt="Screenshot for ${note.client_name || "Unknown Client"}" class="screenshot" style="max-width: 100%; max-height: 400px; object-fit: contain;" crossorigin="anonymous" />
      </div>
      ` : ""}
      <div class="financial-details">
        <div class="detail-item">
          <div class="detail-label">Credit Limit</div>
          <div class="detail-value">R ${note.credit_limit?.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Overdue Amount</div>
          <div class="detail-value ${overdueClass}">R ${note.overdue?.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Current Balance</div>
          <div class="detail-value ${balanceClass}">R ${note.balance?.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}</div>
        </div>
      </div>
      <div class="summary">
        <strong>Summary:</strong> ${(note.user_edited || note.summary || "No summary").replace(/\n/g, '<br>')}
      </div>
      <div style="margin-top: 15px;">
        <span class="urgency ${urgencyClass}">${note.urgency || "medium"}</span>
      </div>
    </div>
    `;
  });

  html += `
</body>
</html>`;
  
  return html;
}

function generateGroupReport(notes: any[], profile: any, groupName: string): string {
  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      padding: 30px 40px; 
      line-height: 1.7; 
      background: #ffffff;
      color: #1a1a1a;
    }
    .header { 
      margin-bottom: 40px; 
      padding-bottom: 20px; 
      border-bottom: 3px solid #0066cc; 
    }
    h1 { 
      color: #0066cc; 
      font-size: 28px; 
      font-weight: 700; 
      margin-bottom: 10px;
      letter-spacing: -0.5px;
    }
    .report-meta {
      color: #666;
      font-size: 14px;
      margin-top: 5px;
    }
    .debtor-entry { 
      margin-bottom: 35px; 
      page-break-inside: avoid; 
      border: 2px solid #e0e0e0; 
      padding: 25px; 
      border-radius: 8px; 
      background: #fafafa;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      transition: all 0.3s ease;
    }
    .debtor-header { 
      font-size: 20px; 
      font-weight: 700; 
      color: #0066cc; 
      margin-bottom: 20px; 
      padding-bottom: 12px;
      border-bottom: 2px solid #e0e0e0;
    }
    .financial-details { 
      display: grid; 
      grid-template-columns: repeat(3, 1fr); 
      gap: 20px; 
      margin: 20px 0; 
    }
    .detail-item { 
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%); 
      padding: 18px; 
      border-radius: 6px; 
      border: 1px solid #e8e8e8;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .detail-label { 
      font-size: 11px; 
      color: #888; 
      margin-bottom: 8px; 
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }
    .detail-value { 
      font-size: 18px; 
      font-weight: 700; 
      color: #1a1a1a;
    }
    .detail-value.overdue { color: #d32f2f; }
    .detail-value.balance { color: #0066cc; }
    .summary { 
      margin: 20px 0; 
      padding: 18px 20px; 
      background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); 
      border-left: 4px solid #0066cc; 
      border-radius: 4px;
      font-size: 14px;
      line-height: 1.8;
      color: #333;
    }
    .summary strong {
      color: #0066cc;
      font-weight: 600;
    }
    .urgency { 
      display: inline-block; 
      padding: 8px 16px; 
      border-radius: 20px; 
      font-size: 12px; 
      font-weight: 600; 
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .urgency-high { background: #ffebee; color: #c62828; border: 1px solid #ef5350; }
    .urgency-medium { background: #fff3e0; color: #e65100; border: 1px solid #ff9800; }
    .urgency-low { background: #e8f5e9; color: #2e7d32; border: 1px solid #4caf50; }
    .urgency-urgent { background: #fce4ec; color: #880e4f; border: 1px solid #e91e63; }
    .screenshot-container {
      margin: 20px 0;
      padding: 15px;
      background: #ffffff;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      page-break-inside: avoid;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .screenshot {
      max-width: 100%; 
      height: auto; 
      border-radius: 6px;
      display: block;
      margin: 0 auto;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .screenshot-label {
      font-size: 11px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
      font-weight: 600;
    }
    h2 {
      color: #0066cc;
      font-size: 24px;
      font-weight: 600;
      margin: 30px 0 20px 0;
      padding-bottom: 10px;
      border-bottom: 2px solid #e0e0e0;
    }
    @media print {
      .debtor-entry { page-break-inside: avoid; }
      body { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Group Report: ${groupName}</h1>
    <div class="report-meta">
      <strong>Total Notes:</strong> ${notes.length} | 
      <strong>Generated:</strong> ${new Date().toLocaleString()}
    </div>
  </div>
`;

  // Group notes by day
  const notesByDay: { [key: string]: any[] } = {};
  notes.forEach((note) => {
    const date = new Date(note.created_at);
    const dateKey = date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    if (!notesByDay[dateKey]) {
      notesByDay[dateKey] = [];
    }
    notesByDay[dateKey].push(note);
  });

  // Sort dates (newest first) - need to sort by actual date values
  const sortedDates = Object.keys(notesByDay).sort((a, b) => {
    // Get the first note's date from each day group for comparison
    const dateA = notesByDay[a][0]?.created_at ? new Date(notesByDay[a][0].created_at).getTime() : 0;
    const dateB = notesByDay[b][0]?.created_at ? new Date(notesByDay[b][0].created_at).getTime() : 0;
    return dateB - dateA;
  });

  // Generate content for each day
  if (sortedDates.length === 0) {
    html += `
  <div style="text-align: center; padding: 40px; color: #666;">
    <p style="font-size: 18px; margin-bottom: 10px;">No notes found in this group.</p>
    <p style="font-size: 14px;">Add notes to this group to see them in the report.</p>
  </div>
`;
  } else {
    sortedDates.forEach((dateKey) => {
      html += `<h2>${dateKey}</h2>`;
      notesByDay[dateKey].forEach((note) => {
      const urgencyClass = note.urgency 
        ? `urgency-${note.urgency.toLowerCase()}` 
        : "urgency-medium";
      
      html += `
  <div class="debtor-entry">
    <div class="debtor-header">
      ${note.client_name || "Unknown Client"}
      ${note.urgency ? `<span class="urgency ${urgencyClass}">${note.urgency}</span>` : ""}
    </div>
    <div class="financial-details">
      <div class="detail-item">
        <div class="detail-label">Credit Limit</div>
        <div class="detail-value">R ${(note.credit_limit || 0).toLocaleString()}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Overdue</div>
        <div class="detail-value overdue">R ${(note.overdue || 0).toLocaleString()}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Balance</div>
        <div class="detail-value balance">R ${(note.balance || 0).toLocaleString()}</div>
      </div>
    </div>
    ${note.summary ? `<div class="summary">${note.summary}</div>` : ""}
    ${note.debtors_files?.file_url ? `
    <div class="screenshot-container">
      <div class="screenshot-label">Screenshot</div>
      <img src="${note.debtors_files.file_url}" alt="Screenshot" class="screenshot" />
    </div>
    ` : ""}
  </div>
`;
      });
    });
  }

  html += `
</body>
</html>`;

  return html;
}

function generateWeeklyReport(notes: any[], profile: any): string {
  // Calculate totals
  const totalOverdue = notes.reduce((sum, note) => sum + (note.overdue || 0), 0);
  const totalBalance = notes.reduce((sum, note) => sum + (note.balance || 0), 0);
  const urgentCount = notes.filter((n) => n.urgency === "urgent").length;
  const highCount = notes.filter((n) => n.urgency === "high").length;

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      padding: 30px 40px; 
      line-height: 1.7; 
      background: #ffffff;
      color: #1a1a1a;
    }
    .header { 
      margin-bottom: 40px; 
      padding-bottom: 20px; 
      border-bottom: 3px solid #0066cc; 
    }
    h1 { 
      color: #0066cc; 
      font-size: 28px; 
      font-weight: 700; 
      margin-bottom: 10px;
      letter-spacing: -0.5px;
    }
    .report-meta {
      color: #666;
      font-size: 14px;
      margin-top: 5px;
    }
    .metrics { 
      background: linear-gradient(135deg, #0066cc 0%, #0052a3 100%); 
      padding: 30px; 
      border-radius: 12px; 
      margin-bottom: 35px; 
      box-shadow: 0 4px 12px rgba(0,102,204,0.2);
    }
    .metrics h2 { 
      margin-top: 0; 
      color: #ffffff; 
      font-size: 22px;
      font-weight: 600;
      margin-bottom: 25px;
    }
    .metrics-grid { 
      display: grid; 
      grid-template-columns: repeat(4, 1fr); 
      gap: 20px; 
    }
    .metric-item { 
      background: rgba(255,255,255,0.95); 
      padding: 20px; 
      border-radius: 8px; 
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-align: center;
    }
    .metric-label { 
      font-size: 11px; 
      color: #666; 
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .metric-value { 
      font-size: 24px; 
      font-weight: 700; 
      color: #0066cc; 
    }
    .metric-value.overdue { color: #d32f2f; }
    .debtor-entry { 
      margin-bottom: 35px; 
      page-break-inside: avoid; 
      border: 2px solid #e0e0e0; 
      padding: 25px; 
      border-radius: 8px; 
      background: #fafafa;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .debtor-header { 
      font-size: 20px; 
      font-weight: 700; 
      color: #0066cc; 
      margin-bottom: 20px; 
      padding-bottom: 12px;
      border-bottom: 2px solid #e0e0e0;
    }
    .financial-details { 
      display: grid; 
      grid-template-columns: repeat(3, 1fr); 
      gap: 20px; 
      margin: 20px 0; 
    }
    .detail-item { 
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%); 
      padding: 18px; 
      border-radius: 6px; 
      border: 1px solid #e8e8e8;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .detail-label { 
      font-size: 11px; 
      color: #888; 
      margin-bottom: 8px; 
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }
    .detail-value { 
      font-size: 18px; 
      font-weight: 700; 
      color: #1a1a1a;
    }
    .detail-value.overdue { color: #d32f2f; }
    .detail-value.balance { color: #0066cc; }
    .summary { 
      margin: 20px 0; 
      padding: 18px 20px; 
      background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); 
      border-left: 4px solid #0066cc; 
      border-radius: 4px;
      font-size: 14px;
      line-height: 1.8;
      color: #333;
    }
    .summary strong {
      color: #0066cc;
      font-weight: 600;
    }
    .urgency { 
      display: inline-block; 
      padding: 8px 16px; 
      border-radius: 20px; 
      font-size: 12px; 
      font-weight: 600; 
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .urgency-high { background: #ffebee; color: #c62828; border: 1px solid #ef5350; }
    .urgency-medium { background: #fff3e0; color: #e65100; border: 1px solid #ff9800; }
    .urgency-low { background: #e8f5e9; color: #2e7d32; border: 1px solid #4caf50; }
    .urgency-urgent { background: #fce4ec; color: #880e4f; border: 1px solid #e91e63; }
    .screenshot-container {
      margin: 20px 0;
      padding: 15px;
      background: #ffffff;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      page-break-inside: avoid;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .screenshot {
      max-width: 100%; 
      height: auto; 
      border-radius: 6px;
      display: block;
      margin: 0 auto;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .screenshot-label {
      font-size: 11px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
      font-weight: 600;
    }
    h2 {
      color: #0066cc;
      font-size: 24px;
      font-weight: 600;
      margin: 30px 0 20px 0;
      padding-bottom: 10px;
      border-bottom: 2px solid #e0e0e0;
    }
    @media print {
      .debtor-entry { page-break-inside: avoid; }
      body { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Weekly Debtor Summary</h1>
    <div class="report-meta">
      <strong>Total Notes:</strong> ${notes.length} | 
      <strong>Generated:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
    </div>
  </div>
  
  <div class="metrics">
    <h2>Key Metrics</h2>
    <div class="metrics-grid">
      <div class="metric-item">
        <div class="metric-label">Total Overdue</div>
        <div class="metric-value overdue">R ${totalOverdue.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div class="metric-item">
        <div class="metric-label">Total Balance</div>
        <div class="metric-value">R ${totalBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div class="metric-item">
        <div class="metric-label">Urgent Cases</div>
        <div class="metric-value">${urgentCount}</div>
      </div>
      <div class="metric-item">
        <div class="metric-label">High Priority</div>
        <div class="metric-value">${highCount}</div>
      </div>
    </div>
  </div>

  <h2>Client Details</h2>
`;

  notes.forEach((note, index) => {
    // Handle different data structures from Supabase join
    let fileUrl: string | null = null;
    if (note.debtors_files) {
      if (Array.isArray(note.debtors_files) && note.debtors_files.length > 0) {
        fileUrl = note.debtors_files[0].file_url;
      } else if (typeof note.debtors_files === 'object' && note.debtors_files.file_url) {
        fileUrl = note.debtors_files.file_url;
      }
    }
    
    const urgencyClass = `urgency-${(note.urgency || "medium").toLowerCase()}`;
    const overdueClass = (note.overdue && note.overdue > 0) ? "overdue" : "";
    const balanceClass = "balance";
    
    html += `
    <div class="debtor-entry">
      <div class="debtor-header">${index + 1}. ${note.client_name || "Unknown Client"}</div>
      ${fileUrl ? `
      <div class="screenshot-container">
        <div class="screenshot-label">Original Screenshot</div>
        <img src="${fileUrl}" alt="Screenshot for ${note.client_name || "Unknown Client"}" class="screenshot" style="max-width: 100%; max-height: 400px; object-fit: contain;" crossorigin="anonymous" />
      </div>
      ` : ""}
      <div class="financial-details">
        <div class="detail-item">
          <div class="detail-label">Credit Limit</div>
          <div class="detail-value">R ${note.credit_limit?.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Overdue Amount</div>
          <div class="detail-value ${overdueClass}">R ${note.overdue?.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Current Balance</div>
          <div class="detail-value ${balanceClass}">R ${note.balance?.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}</div>
        </div>
      </div>
      <div class="summary">
        <strong>Summary:</strong> ${(note.user_edited || note.summary || "No summary").replace(/\n/g, '<br>')}
      </div>
      <div style="margin-top: 15px;">
        <span class="urgency ${urgencyClass}">${note.urgency || "medium"}</span>
      </div>
    </div>
    `;
  });

  html += `
</body>
</html>`;
  
  return html;
}

