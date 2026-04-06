export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fleets: {
        Row: {
          id: string;
          name: string;
          created_by_user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by_user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_by_user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fleet_memberships: {
        Row: {
          id: string;
          fleet_id: string;
          user_id: string;
          role: Database['public']['Enums']['membership_role'];
          invited_by_user_id: string | null;
          invitation_id: string | null;
          joined_at: string;
          ended_at: string | null;
          ended_by_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          fleet_id: string;
          user_id: string;
          role: Database['public']['Enums']['membership_role'];
          invited_by_user_id?: string | null;
          invitation_id?: string | null;
          joined_at?: string;
          ended_at?: string | null;
          ended_by_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          fleet_id?: string;
          user_id?: string;
          role?: Database['public']['Enums']['membership_role'];
          invited_by_user_id?: string | null;
          invitation_id?: string | null;
          joined_at?: string;
          ended_at?: string | null;
          ended_by_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fleet_invitations: {
        Row: {
          id: string;
          fleet_id: string;
          email: string;
          role: Database['public']['Enums']['membership_role'];
          status: Database['public']['Enums']['invitation_status'];
          token_hash: string;
          expires_at: string;
          invited_by_user_id: string;
          accepted_by_user_id: string | null;
          accepted_at: string | null;
          revoked_by_user_id: string | null;
          revoked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          fleet_id: string;
          email: string;
          role: Database['public']['Enums']['membership_role'];
          status?: Database['public']['Enums']['invitation_status'];
          token_hash: string;
          expires_at: string;
          invited_by_user_id: string;
          accepted_by_user_id?: string | null;
          accepted_at?: string | null;
          revoked_by_user_id?: string | null;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          fleet_id?: string;
          email?: string;
          role?: Database['public']['Enums']['membership_role'];
          status?: Database['public']['Enums']['invitation_status'];
          token_hash?: string;
          expires_at?: string;
          invited_by_user_id?: string;
          accepted_by_user_id?: string | null;
          accepted_at?: string | null;
          revoked_by_user_id?: string | null;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          fleet_id: string;
          name: string;
          plate: string;
          status: Database['public']['Enums']['vehicle_status'];
          blocked_until: string | null;
          blocked_reason: string | null;
          created_by_user_id: string | null;
          updated_by_user_id: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          fleet_id: string;
          name: string;
          plate: string;
          status?: Database['public']['Enums']['vehicle_status'];
          blocked_until?: string | null;
          blocked_reason?: string | null;
          created_by_user_id?: string | null;
          updated_by_user_id?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          fleet_id?: string;
          name?: string;
          plate?: string;
          status?: Database['public']['Enums']['vehicle_status'];
          blocked_until?: string | null;
          blocked_reason?: string | null;
          created_by_user_id?: string | null;
          updated_by_user_id?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vehicle_assignments: {
        Row: {
          id: string;
          fleet_id: string;
          vehicle_id: string;
          driver_user_id: string;
          driver_membership_id: string;
          status: Database['public']['Enums']['assignment_status'];
          requested_by_user_id: string | null;
          approved_by_user_id: string | null;
          ended_by_user_id: string | null;
          requested_at: string;
          started_at: string | null;
          ended_at: string | null;
          ended_reason: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          fleet_id: string;
          vehicle_id: string;
          driver_user_id: string;
          driver_membership_id: string;
          status?: Database['public']['Enums']['assignment_status'];
          requested_by_user_id?: string | null;
          approved_by_user_id?: string | null;
          ended_by_user_id?: string | null;
          requested_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
          ended_reason?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          fleet_id?: string;
          vehicle_id?: string;
          driver_user_id?: string;
          driver_membership_id?: string;
          status?: Database['public']['Enums']['assignment_status'];
          requested_by_user_id?: string | null;
          approved_by_user_id?: string | null;
          ended_by_user_id?: string | null;
          requested_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
          ended_reason?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      membership_role: 'owner' | 'admin' | 'driver';
      invitation_status: 'pending' | 'accepted' | 'revoked' | 'expired';
      vehicle_status: 'available' | 'driving' | 'blocked';
      assignment_status: 'pending' | 'active' | 'ended' | 'rejected' | 'cancelled';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
