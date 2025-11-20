import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all users (for single-user, just get the first active user)
    const { data: users } = await supabase.auth.admin.listUsers();

    for (const user of users.users) {
      // Generate daily PDF report
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: notes } = await supabase
        .from("debtors_notes")
        .select("*")
        .eq("user_id", user.id)
        .gte("created_at", today.toISOString())
        .lt("created_at", tomorrow.toISOString())
        .order("created_at", { ascending: false });

      if (notes && notes.length > 0) {
        // Generate PDF
        const { data: reportData, error: reportError } = await supabase.functions.invoke(
          "generate-pdf-report",
          {
            body: {
              report_type: "daily",
              start_date: today.toISOString(),
              end_date: tomorrow.toISOString(),
            },
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
            },
          }
        );

        if (!reportError && reportData?.pdf_html) {
          // Send via WhatsApp
          const whatsappNumber = Deno.env.get(`WHATSAPP_NUMBER_${user.id}`) || 
                                 Deno.env.get("DEFAULT_WHATSAPP_NUMBER");

          if (whatsappNumber) {
            await supabase.functions.invoke("send-whatsapp", {
              body: {
                phone_number: whatsappNumber,
                message: `Daily Debtor Summary - ${today.toLocaleDateString()}\n\nTotal Notes: ${notes.length}\n\nSee attached PDF for details.`,
                pdf_url: reportData.pdf_html,
              },
              headers: {
                Authorization: `Bearer ${supabaseKey}`,
              },
            });
          }
        }
      }

      // Check and send reminders
      const { data: reminders } = await supabase
        .from("reminders")
        .select("*")
        .eq("user_id", user.id)
        .eq("sent", false)
        .lte("reminder_date", new Date().toISOString());

      if (reminders && reminders.length > 0) {
        for (const reminder of reminders) {
          const { data: task } = reminder.task_id
            ? await supabase.from("tasks").select("*").eq("id", reminder.task_id).single()
            : { data: null };

          const message = task
            ? `Reminder: ${task.title}\n\n${task.description || ""}\n\nDue: ${new Date(task.due_date).toLocaleDateString()}`
            : "You have a reminder scheduled for today.";

          const whatsappNumber = Deno.env.get(`WHATSAPP_NUMBER_${user.id}`) || 
                                 Deno.env.get("DEFAULT_WHATSAPP_NUMBER");

          if (whatsappNumber) {
            await supabase.functions.invoke("send-whatsapp", {
              body: {
                phone_number: whatsappNumber,
                message,
                reminder_id: reminder.id,
              },
              headers: {
                Authorization: `Bearer ${supabaseKey}`,
              },
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});


