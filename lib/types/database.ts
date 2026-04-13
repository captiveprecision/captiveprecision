export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      athlete_team_assignments: {
        Row: {
          athlete_id: string;
          created_at: string;
          id: string;
          team_id: string;
        };
        Insert: {
          athlete_id: string;
          created_at?: string;
          id?: string;
          team_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["athlete_team_assignments"]["Insert"]>;
      };
      athletes: {
        Row: {
          birth_date: string | null;
          created_at: string;
          created_by_profile_id: string | null;
          first_name: string;
          gym_id: string | null;
          id: string;
          last_name: string;
          metadata: Json;
          notes: string;
          parent_contacts: Json;
          registration_number: string | null;
          updated_at: string;
        };
        Insert: {
          birth_date?: string | null;
          created_at?: string;
          created_by_profile_id?: string | null;
          first_name: string;
          gym_id?: string | null;
          id?: string;
          last_name: string;
          metadata?: Json;
          notes?: string;
          parent_contacts?: Json;
          registration_number?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["athletes"]["Insert"]>;
      };
      planner_evaluations: {
        Row: {
          athlete_id: string;
          created_at: string;
          id: string;
          occurred_at: string | null;
          planner_project_id: string;
          record: Json;
          updated_at: string;
        };
        Insert: {
          athlete_id: string;
          created_at?: string;
          id: string;
          occurred_at?: string | null;
          planner_project_id: string;
          record?: Json;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["planner_evaluations"]["Insert"]>;
      };
      planner_projects: {
        Row: {
          created_at: string;
          gym_id: string | null;
          id: string;
          name: string;
          owner_profile_id: string | null;
          pipeline_stage: string;
          qualification_rules: Json;
          scope_type: string;
          status: string;
          template: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          gym_id?: string | null;
          id: string;
          name: string;
          owner_profile_id?: string | null;
          pipeline_stage?: string;
          qualification_rules?: Json;
          scope_type: string;
          status?: string;
          template?: Json;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["planner_projects"]["Insert"]>;
      };
      gym_coach_licenses: {
        Row: {
          coach_profile_id: string;
          created_at: string;
          gym_id: string;
          id: string;
          license_seat_name: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          coach_profile_id: string;
          created_at?: string;
          gym_id: string;
          id?: string;
          license_seat_name?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["gym_coach_licenses"]["Insert"]>;
      };
      gyms: {
        Row: {
          coach_license_limit: number;
          created_at: string;
          id: string;
          membership_plan_id: string | null;
          metadata: Json;
          name: string;
          owner_profile_id: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          coach_license_limit?: number;
          created_at?: string;
          id?: string;
          membership_plan_id?: string | null;
          metadata?: Json;
          name: string;
          owner_profile_id: string;
          slug: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["gyms"]["Insert"]>;
      };
      membership_plans: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          description: string | null;
          external_product_id: string | null;
          id: string;
          interval_label: string | null;
          metadata: Json;
          name: string;
          provider: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          description?: string | null;
          external_product_id?: string | null;
          id?: string;
          interval_label?: string | null;
          metadata?: Json;
          name: string;
          provider?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["membership_plans"]["Insert"]>;
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          beta_access_status: string;
          beta_requested_at: string | null;
          beta_reviewed_at: string | null;
          beta_reviewed_by: string | null;
          bio: string | null;
          city: string | null;
          created_at: string;
          display_name: string | null;
          email: string | null;
          gym_name: string | null;
          headline: string | null;
          id: string;
          membership_type: string;
          primary_gym_id: string | null;
          role: string;
          role_label: string | null;
          state: string | null;
          teams_summary: string | null;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          beta_access_status?: string;
          beta_requested_at?: string | null;
          beta_reviewed_at?: string | null;
          beta_reviewed_by?: string | null;
          bio?: string | null;
          city?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          gym_name?: string | null;
          headline?: string | null;
          id: string;
          membership_type?: string;
          primary_gym_id?: string | null;
          role?: string;
          role_label?: string | null;
          state?: string | null;
          teams_summary?: string | null;
          updated_at?: string;
          username?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      scoring_sections: {
        Row: {
          created_at: string;
          guidance: string | null;
          id: string;
          max_points: number;
          scoring_system_version_id: string;
          section_key: string;
          section_name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          guidance?: string | null;
          id?: string;
          max_points?: number;
          scoring_system_version_id: string;
          section_key: string;
          section_name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["scoring_sections"]["Insert"]>;
      };
      scoring_system_versions: {
        Row: {
          comments: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          label: string;
          scoring_system_id: string;
          season_label: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          comments?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          label: string;
          scoring_system_id: string;
          season_label: string;
          status?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["scoring_system_versions"]["Insert"]>;
      };
      scoring_systems: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          status?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["scoring_systems"]["Insert"]>;
      };
      team_coaches: {
        Row: {
          coach_profile_id: string;
          created_at: string;
          id: string;
          role: string;
          team_id: string;
        };
        Insert: {
          coach_profile_id: string;
          created_at?: string;
          id?: string;
          role?: string;
          team_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["team_coaches"]["Insert"]>;
      };
      team_season_plans: {
        Row: {
          checkpoints: Json;
          created_at: string;
          id: string;
          notes: string;
          planner_project_id: string;
          status: string;
          team_id: string;
          updated_at: string;
        };
        Insert: {
          checkpoints?: Json;
          created_at?: string;
          id?: string;
          notes?: string;
          planner_project_id: string;
          status?: string;
          team_id: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["team_season_plans"]["Insert"]>;
      };
      team_skill_plans: {
        Row: {
          created_at: string;
          id: string;
          notes: string;
          planner_project_id: string;
          selections: Json;
          status: string;
          team_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          notes?: string;
          planner_project_id: string;
          selections?: Json;
          status?: string;
          team_id: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["team_skill_plans"]["Insert"]>;
      };
      teams: {
        Row: {
          created_at: string;
          division: string | null;
          gym_id: string | null;
          id: string;
          metadata: Json;
          name: string;
          primary_coach_profile_id: string | null;
          season_label: string | null;
          updated_at: string;
          visibility_scope: string;
        };
        Insert: {
          created_at?: string;
          division?: string | null;
          gym_id?: string | null;
          id?: string;
          metadata?: Json;
          name: string;
          primary_coach_profile_id?: string | null;
          season_label?: string | null;
          updated_at?: string;
          visibility_scope?: string;
        };
        Update: Partial<Database["public"]["Tables"]["teams"]["Insert"]>;
      };
      team_routine_plans: {
        Row: {
          created_at: string;
          document: Json;
          id: string;
          notes: string;
          planner_project_id: string;
          status: string;
          team_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          document?: Json;
          id?: string;
          notes?: string;
          planner_project_id: string;
          status?: string;
          team_id: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["team_routine_plans"]["Insert"]>;
      };
      tool_access_rules: {
        Row: {
          access_tier: string;
          created_at: string;
          id: string;
          membership_plan_id: string | null;
          tool_id: string;
        };
        Insert: {
          access_tier?: string;
          created_at?: string;
          id?: string;
          membership_plan_id?: string | null;
          tool_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["tool_access_rules"]["Insert"]>;
      };
      tool_records: {
        Row: {
          created_at: string;
          id: string;
          input_data: Json | null;
          output_data: Json | null;
          status: string;
          tool_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          input_data?: Json | null;
          output_data?: Json | null;
          status?: string;
          tool_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["tool_records"]["Insert"]>;
      };
      tools: {
        Row: {
          config: Json;
          created_at: string;
          description: string | null;
          icon_name: string | null;
          id: string;
          is_premium: boolean;
          name: string;
          slug: string;
          sort_order: number;
          status: string;
          updated_at: string;
        };
        Insert: {
          config?: Json;
          created_at?: string;
          description?: string | null;
          icon_name?: string | null;
          id?: string;
          is_premium?: boolean;
          name: string;
          slug: string;
          sort_order?: number;
          status?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tools"]["Insert"]>;
      };
      user_memberships: {
        Row: {
          cancel_at_period_end: boolean;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          id: string;
          membership_plan_id: string | null;
          metadata: Json;
          provider: string;
          provider_customer_id: string | null;
          provider_membership_id: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          membership_plan_id?: string | null;
          metadata?: Json;
          provider?: string;
          provider_customer_id?: string | null;
          provider_membership_id: string;
          status: string;
          updated_at?: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_memberships"]["Insert"]>;
      };
    };
    Functions: {
      user_has_tool_access: {
        Args: {
          p_tool_slug: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
    };
  };
};
