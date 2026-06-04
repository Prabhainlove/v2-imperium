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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          agent: string
          created_at: string
          detail: string
          id: number
          status: string
          task_id: string
          user_id: string
        }
        Insert: {
          action: string
          agent?: string
          created_at?: string
          detail?: string
          id?: number
          status?: string
          task_id?: string
          user_id: string
        }
        Update: {
          action?: string
          agent?: string
          created_at?: string
          detail?: string
          id?: number
          status?: string
          task_id?: string
          user_id?: string
        }
        Relationships: []
      }
      application_timeline: {
        Row: {
          application_id: string
          created_at: string
          event_type: string
          from_status: string
          id: string
          note: string
          to_status: string
          user_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          event_type: string
          from_status?: string
          id?: string
          note?: string
          to_status?: string
          user_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          event_type?: string
          from_status?: string
          id?: string
          note?: string
          to_status?: string
          user_id?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          applied_at: string | null
          company: string
          cover_letter_md: string
          cover_letter_version: string
          created_at: string
          id: string
          interview_notes: string
          job_title: string
          listing_id: string
          match_score: number
          next_action: string
          next_action_at: string | null
          notes: string
          recruiter_notes: string
          resume_md: string
          resume_version: string
          source: string
          status: string
          task_id: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          company: string
          cover_letter_md?: string
          cover_letter_version?: string
          created_at?: string
          id?: string
          interview_notes?: string
          job_title: string
          listing_id: string
          match_score?: number
          next_action?: string
          next_action_at?: string | null
          notes?: string
          recruiter_notes?: string
          resume_md?: string
          resume_version?: string
          source?: string
          status?: string
          task_id?: string
          updated_at?: string
          url?: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          company?: string
          cover_letter_md?: string
          cover_letter_version?: string
          created_at?: string
          id?: string
          interview_notes?: string
          job_title?: string
          listing_id?: string
          match_score?: number
          next_action?: string
          next_action_at?: string | null
          notes?: string
          recruiter_notes?: string
          resume_md?: string
          resume_version?: string
          source?: string
          status?: string
          task_id?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "job_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_events: {
        Row: {
          action: string
          created_at: string
          detail: string
          id: number
          level: string
          run_id: string
          step: string
          url: string
          user_id: string
        }
        Insert: {
          action?: string
          created_at?: string
          detail?: string
          id?: number
          level?: string
          run_id: string
          step?: string
          url?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          detail?: string
          id?: number
          level?: string
          run_id?: string
          step?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          agent_token: string
          application_id: string | null
          approval_required: boolean
          approved: boolean | null
          company: string
          cover_letter_text: string | null
          created_at: string
          current_action: string
          current_step: string
          current_url: string
          error: string | null
          id: string
          job_title: string
          job_url: string
          progress: number
          resume_text: string | null
          screenshot_b64: string | null
          status: string
          summary: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_token?: string
          application_id?: string | null
          approval_required?: boolean
          approved?: boolean | null
          company?: string
          cover_letter_text?: string | null
          created_at?: string
          current_action?: string
          current_step?: string
          current_url?: string
          error?: string | null
          id?: string
          job_title?: string
          job_url?: string
          progress?: number
          resume_text?: string | null
          screenshot_b64?: string | null
          status?: string
          summary?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_token?: string
          application_id?: string | null
          approval_required?: boolean
          approved?: boolean | null
          company?: string
          cover_letter_text?: string | null
          created_at?: string
          current_action?: string
          current_step?: string
          current_url?: string
          error?: string | null
          id?: string
          job_title?: string
          job_url?: string
          progress?: number
          resume_text?: string | null
          screenshot_b64?: string | null
          status?: string
          summary?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      brain_memory: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          key_hash: string
          kind: string
          model: string
          payload: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          kind: string
          model?: string
          payload?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          kind?: string
          model?: string
          payload?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      candidate_profiles: {
        Row: {
          created_at: string
          education: Json
          email: string
          experience: Json
          headline: string
          id: string
          links: Json
          location: string
          name: string
          phone: string
          skills: Json
          summary: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          education?: Json
          email?: string
          experience?: Json
          headline?: string
          id?: string
          links?: Json
          location?: string
          name?: string
          phone?: string
          skills?: Json
          summary?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          education?: Json
          email?: string
          experience?: Json
          headline?: string
          id?: string
          links?: Json
          location?: string
          name?: string
          phone?: string
          skills?: Json
          summary?: string
          updated_at?: string
        }
        Relationships: []
      }
      interviews: {
        Row: {
          application_id: string | null
          company: string
          created_at: string
          feedback: string
          id: string
          interview_at: string | null
          location: string
          notes: string
          outcome: string
          position: string
          recruiter: string
          stage: string
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          company: string
          created_at?: string
          feedback?: string
          id?: string
          interview_at?: string | null
          location?: string
          notes?: string
          outcome?: string
          position?: string
          recruiter?: string
          stage?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          company?: string
          created_at?: string
          feedback?: string
          id?: string
          interview_at?: string | null
          location?: string
          notes?: string
          outcome?: string
          position?: string
          recruiter?: string
          stage?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_listings: {
        Row: {
          bookmarked: boolean
          company: string
          description: string
          discovered_at: string
          external_id: string
          id: string
          location: string
          match_score: number
          posted_at: string | null
          remote: boolean
          salary_currency: string
          salary_max: number | null
          salary_min: number | null
          saved: boolean
          source: string
          status: string
          task_id: string
          tech_stack: Json
          title: string
          url: string
          user_id: string
        }
        Insert: {
          bookmarked?: boolean
          company: string
          description?: string
          discovered_at?: string
          external_id: string
          id?: string
          location?: string
          match_score?: number
          posted_at?: string | null
          remote?: boolean
          salary_currency?: string
          salary_max?: number | null
          salary_min?: number | null
          saved?: boolean
          source: string
          status?: string
          task_id?: string
          tech_stack?: Json
          title: string
          url?: string
          user_id: string
        }
        Update: {
          bookmarked?: boolean
          company?: string
          description?: string
          discovered_at?: string
          external_id?: string
          id?: string
          location?: string
          match_score?: number
          posted_at?: string | null
          remote?: boolean
          salary_currency?: string
          salary_max?: number | null
          salary_min?: number | null
          saved?: boolean
          source?: string
          status?: string
          task_id?: string
          tech_stack?: Json
          title?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          achievements: Json
          certifications: Json
          created_at: string
          education: Json
          email: string
          experience: Json
          github_intel: Json
          github_url: string
          headline: string
          id: string
          languages: Json
          linkedin_intel: Json
          linkedin_url: string
          location: string
          name: string
          onboarded: boolean
          phone: string
          portfolio_url: string
          profile_intel: Json
          projects: Json
          salary_expectation: Json
          seniority: string
          skills: Json
          summary: string
          target_locations: Json
          target_role: string
          updated_at: string
          work_mode: string
        }
        Insert: {
          achievements?: Json
          certifications?: Json
          created_at?: string
          education?: Json
          email?: string
          experience?: Json
          github_intel?: Json
          github_url?: string
          headline?: string
          id: string
          languages?: Json
          linkedin_intel?: Json
          linkedin_url?: string
          location?: string
          name?: string
          onboarded?: boolean
          phone?: string
          portfolio_url?: string
          profile_intel?: Json
          projects?: Json
          salary_expectation?: Json
          seniority?: string
          skills?: Json
          summary?: string
          target_locations?: Json
          target_role?: string
          updated_at?: string
          work_mode?: string
        }
        Update: {
          achievements?: Json
          certifications?: Json
          created_at?: string
          education?: Json
          email?: string
          experience?: Json
          github_intel?: Json
          github_url?: string
          headline?: string
          id?: string
          languages?: Json
          linkedin_intel?: Json
          linkedin_url?: string
          location?: string
          name?: string
          onboarded?: boolean
          phone?: string
          portfolio_url?: string
          profile_intel?: Json
          projects?: Json
          salary_expectation?: Json
          seniority?: string
          skills?: Json
          summary?: string
          target_locations?: Json
          target_role?: string
          updated_at?: string
          work_mode?: string
        }
        Relationships: []
      }
      resume_documents: {
        Row: {
          content_md: string
          created_at: string
          template: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_md?: string
          created_at?: string
          template?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_md?: string
          created_at?: string
          template?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      resume_versions: {
        Row: {
          content_md: string
          created_at: string
          id: string
          label: string
          template: string
          user_id: string
        }
        Insert: {
          content_md?: string
          created_at?: string
          id?: string
          label?: string
          template?: string
          user_id: string
        }
        Update: {
          content_md?: string
          created_at?: string
          id?: string
          label?: string
          template?: string
          user_id?: string
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
