export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      budget_goals: {
        Row: {
          category: string | null
          created_at: string | null
          current_amount: number | null
          deadline: string | null
          goal_type: string
          id: string
          status: string | null
          target_amount: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          current_amount?: number | null
          deadline?: string | null
          goal_type: string
          id?: string
          status?: string | null
          target_amount: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          current_amount?: number | null
          deadline?: string | null
          goal_type?: string
          id?: string
          status?: string | null
          target_amount?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      context_memory: {
        Row: {
          context: string | null
          created_at: string | null
          embedding: string | null
          id: string
          query: string
          response: string
          user_id: string
        }
        Insert: {
          context?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          query: string
          response: string
          user_id: string
        }
        Update: {
          context?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          query?: string
          response?: string
          user_id?: string
        }
        Relationships: []
      }
      debtors_files: {
        Row: {
          created_at: string | null
          file_name: string | null
          file_url: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_name?: string | null
          file_url: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string | null
          file_url?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      debtors_notes: {
        Row: {
          ai_generated: string | null
          balance: number | null
          client_name: string | null
          created_at: string | null
          credit_limit: number | null
          file_id: string | null
          group_name: string | null
          id: string
          overdue: number | null
          sentiment: string | null
          summary: string | null
          updated_at: string | null
          urgency: string | null
          user_edited: string | null
          user_id: string
        }
        Insert: {
          ai_generated?: string | null
          balance?: number | null
          client_name?: string | null
          created_at?: string | null
          credit_limit?: number | null
          file_id?: string | null
          group_name?: string | null
          id?: string
          overdue?: number | null
          sentiment?: string | null
          summary?: string | null
          updated_at?: string | null
          urgency?: string | null
          user_edited?: string | null
          user_id: string
        }
        Update: {
          ai_generated?: string | null
          balance?: number | null
          client_name?: string | null
          created_at?: string | null
          credit_limit?: number | null
          file_id?: string | null
          group_name?: string | null
          id?: string
          overdue?: number | null
          sentiment?: string | null
          summary?: string | null
          updated_at?: string | null
          urgency?: string | null
          user_edited?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debtors_notes_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "debtors_files"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_memory: {
        Row: {
          context: string | null
          created_at: string | null
          id: string
          query: string
          response: string
          user_id: string
        }
        Insert: {
          context?: string | null
          created_at?: string | null
          id?: string
          query: string
          response: string
          user_id: string
        }
        Update: {
          context?: string | null
          created_at?: string | null
          id?: string
          query?: string
          response?: string
          user_id?: string
        }
        Relationships: []
      }
      learning_log: {
        Row: {
          context: string | null
          corrected_text: string
          created_at: string | null
          id: string
          note_type: string | null
          original_text: string
          user_id: string
        }
        Insert: {
          context?: string | null
          corrected_text: string
          created_at?: string | null
          id?: string
          note_type?: string | null
          original_text: string
          user_id: string
        }
        Update: {
          context?: string | null
          corrected_text?: string
          created_at?: string | null
          id?: string
          note_type?: string | null
          original_text?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_notes: {
        Row: {
          content: string
          created_at: string | null
          id: string
          tags: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      personality_profile: {
        Row: {
          formatting_style: Json | null
          id: string
          phrasing_examples: Json | null
          preferred_verbs: Json | null
          tone_direct: number | null
          tone_empathetic: number | null
          tone_formal: number | null
          updated_at: string | null
          user_id: string
          word_choices: Json | null
        }
        Insert: {
          formatting_style?: Json | null
          id?: string
          phrasing_examples?: Json | null
          preferred_verbs?: Json | null
          tone_direct?: number | null
          tone_empathetic?: number | null
          tone_formal?: number | null
          updated_at?: string | null
          user_id: string
          word_choices?: Json | null
        }
        Update: {
          formatting_style?: Json | null
          id?: string
          phrasing_examples?: Json | null
          preferred_verbs?: Json | null
          tone_direct?: number | null
          tone_empathetic?: number | null
          tone_formal?: number | null
          updated_at?: string | null
          user_id?: string
          word_choices?: Json | null
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string | null
          id: string
          reminder_date: string
          sent: boolean | null
          task_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          reminder_date: string
          sent?: boolean | null
          task_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          reminder_date?: string
          sent?: boolean | null
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          pdf_url: string | null
          title: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          pdf_url?: string | null
          title: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          pdf_url?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          attachments: Json | null
          completed: boolean | null
          created_at: string | null
          description: string | null
          due_date: string | null
          estimated_duration: number | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"] | null
          scheduled_time: string | null
          status: Database["public"]["Enums"]["task_status"] | null
          time_period: Database["public"]["Enums"]["task_time_period"] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          completed?: boolean | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_duration?: number | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"] | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          time_period?: Database["public"]["Enums"]["task_time_period"] | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attachments?: Json | null
          completed?: boolean | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_duration?: number | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"] | null
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          time_period?: Database["public"]["Enums"]["task_time_period"] | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_finances: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          date: string
          description: string | null
          embedding: string | null
          id: string
          source: string | null
          type: Database["public"]["Enums"]["finance_type"]
          updated_at: string | null
          user_id: string
          vendor: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          date?: string
          description?: string | null
          embedding?: string | null
          id?: string
          source?: string | null
          type: Database["public"]["Enums"]["finance_type"]
          updated_at?: string | null
          user_id: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          date?: string
          description?: string | null
          embedding?: string | null
          id?: string
          source?: string | null
          type?: Database["public"]["Enums"]["finance_type"]
          updated_at?: string | null
          user_id?: string
          vendor?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      finance_type: "income" | "expense"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "pending" | "in_progress" | "completed" | "cancelled"
      task_time_period: "morning" | "afternoon" | "evening" | "unscheduled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      finance_type: ["income", "expense"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["pending", "in_progress", "completed", "cancelled"],
      task_time_period: ["morning", "afternoon", "evening", "unscheduled"],
    },
  },
} as const
