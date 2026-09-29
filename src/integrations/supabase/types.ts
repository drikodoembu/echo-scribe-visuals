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
      api_usage: {
        Row: {
          cost_usd: number
          created_at: string
          id: string
          meta: Json
          operation: string
          provider: string
          units: number
          user_id: string
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          id?: string
          meta?: Json
          operation: string
          provider: string
          units?: number
          user_id: string
        }
        Update: {
          cost_usd?: number
          created_at?: string
          id?: string
          meta?: Json
          operation?: string
          provider?: string
          units?: number
          user_id?: string
        }
        Relationships: []
      }
      app_logs: {
        Row: {
          created_at: string
          id: string
          level: string
          message: string
          meta: Json
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string
          message: string
          meta?: Json
          source: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          message?: string
          meta?: Json
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audio_assets: {
        Row: {
          created_at: string
          duration_seconds: number | null
          format: string
          id: string
          model: string | null
          script_id: string | null
          size_bytes: number | null
          storage_path: string
          title: string
          updated_at: string
          user_id: string
          voice: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          format?: string
          id?: string
          model?: string | null
          script_id?: string | null
          size_bytes?: number | null
          storage_path: string
          title: string
          updated_at?: string
          user_id: string
          voice: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          format?: string
          id?: string
          model?: string | null
          script_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          title?: string
          updated_at?: string
          user_id?: string
          voice?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_assets_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      image_assets: {
        Row: {
          created_at: string
          height: number | null
          id: string
          mime_type: string | null
          scene_order: number | null
          script_id: string | null
          size_bytes: number | null
          storage_path: string
          title: string
          updated_at: string
          user_id: string
          width: number | null
        }
        Insert: {
          created_at?: string
          height?: number | null
          id?: string
          mime_type?: string | null
          scene_order?: number | null
          script_id?: string | null
          size_bytes?: number | null
          storage_path: string
          title: string
          updated_at?: string
          user_id: string
          width?: number | null
        }
        Update: {
          created_at?: string
          height?: number | null
          id?: string
          mime_type?: string | null
          scene_order?: number | null
          script_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          title?: string
          updated_at?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "image_assets_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      music_tracks: {
        Row: {
          created_at: string
          duration_seconds: number | null
          format: string | null
          id: string
          size_bytes: number | null
          storage_path: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          format?: string | null
          id?: string
          size_bytes?: number | null
          storage_path: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          format?: string | null
          id?: string
          size_bytes?: number | null
          storage_path?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          user_id: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          user_id: string
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      scripts: {
        Row: {
          content: string
          created_at: string
          duration_seconds: number
          format: string
          id: string
          model: string | null
          saint: string | null
          status: string
          title: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          duration_seconds?: number
          format?: string
          id?: string
          model?: string | null
          saint?: string | null
          status?: string
          title: string
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          duration_seconds?: number
          format?: string
          id?: string
          model?: string | null
          saint?: string | null
          status?: string
          title?: string
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          daily_image_limit: number
          daily_script_limit: number
          daily_tts_limit: number
          default_voice_id: string | null
          goals: Json
          image_style: string
          music_style: string
          publishing_schedule: Json
          updated_at: string
          user_id: string
          voice_gender: string
        }
        Insert: {
          created_at?: string
          daily_image_limit?: number
          daily_script_limit?: number
          daily_tts_limit?: number
          default_voice_id?: string | null
          goals?: Json
          image_style?: string
          music_style?: string
          publishing_schedule?: Json
          updated_at?: string
          user_id: string
          voice_gender?: string
        }
        Update: {
          created_at?: string
          daily_image_limit?: number
          daily_script_limit?: number
          daily_tts_limit?: number
          default_voice_id?: string | null
          goals?: Json
          image_style?: string
          music_style?: string
          publishing_schedule?: Json
          updated_at?: string
          user_id?: string
          voice_gender?: string
        }
        Relationships: []
      }
      video_seo: {
        Row: {
          category: string | null
          chapters: Json
          created_at: string
          description: string
          format: string
          hashtags: string[]
          id: string
          keywords: string[]
          language: string
          model: string | null
          pinned_comment: string
          script_id: string | null
          tags: string[]
          thumbnail_text: string
          title: string
          title_options: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          chapters?: Json
          created_at?: string
          description?: string
          format?: string
          hashtags?: string[]
          id?: string
          keywords?: string[]
          language?: string
          model?: string | null
          pinned_comment?: string
          script_id?: string | null
          tags?: string[]
          thumbnail_text?: string
          title?: string
          title_options?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          chapters?: Json
          created_at?: string
          description?: string
          format?: string
          hashtags?: string[]
          id?: string
          keywords?: string[]
          language?: string
          model?: string | null
          pinned_comment?: string
          script_id?: string | null
          tags?: string[]
          thumbnail_text?: string
          title?: string
          title_options?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_seo_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
