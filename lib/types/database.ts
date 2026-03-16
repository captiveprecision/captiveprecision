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
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id: string;
          updated_at?: string;
          username?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
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
      whop_webhook_events: {
        Row: {
          created_at: string;
          error_message: string | null;
          event_type: string;
          id: string;
          payload: Json;
          processed_at: string | null;
          provider_event_id: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          event_type: string;
          id?: string;
          payload: Json;
          processed_at?: string | null;
          provider_event_id: string;
          status?: string;
        };
        Update: Partial<Database["public"]["Tables"]["whop_webhook_events"]["Insert"]>;
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
