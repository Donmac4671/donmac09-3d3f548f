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
      agent_applications: {
        Row: {
          admin_notes: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          location: string
          phone: string
          reason: string
          screenshot_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          location?: string
          phone: string
          reason?: string
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          location?: string
          phone?: string
          reason?: string
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_code_assignments: {
        Row: {
          agent_code: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          agent_code: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          agent_code?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      api_order_logs: {
        Row: {
          created_at: string
          endpoint: string
          error: string | null
          id: string
          method: string
          request_body: Json | null
          response_body: Json | null
          status_code: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          error?: string | null
          id?: string
          method: string
          request_body?: Json | null
          response_body?: Json | null
          status_code?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          error?: string | null
          id?: string
          method?: string
          request_body?: Json | null
          response_body?: Json | null
          status_code?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      api_tokens: {
        Row: {
          created_at: string
          id: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          token_hash: string
          token_prefix: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash: string
          token_prefix: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash?: string
          token_prefix?: string
          user_id?: string
        }
        Relationships: []
      }
      api_webhooks: {
        Row: {
          created_at: string
          is_active: boolean
          secret: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          secret: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          secret?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      broadcasts: {
        Row: {
          audience: string
          created_at: string
          id: string
          message: string
          recipients_count: number
          sent_by: string | null
          title: string
          url: string
        }
        Insert: {
          audience?: string
          created_at?: string
          id?: string
          message: string
          recipients_count?: number
          sent_by?: string | null
          title: string
          url?: string
        }
        Update: {
          audience?: string
          created_at?: string
          id?: string
          message?: string
          recipients_count?: number
          sent_by?: string | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          media_url: string | null
          message: string
          sender_role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          media_url?: string | null
          message: string
          sender_role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          media_url?: string | null
          message?: string
          sender_role?: string
          user_id?: string
        }
        Relationships: []
      }
      complaints: {
        Row: {
          admin_reply: string | null
          created_at: string
          id: string
          message: string
          order_id: string | null
          order_ref: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message: string
          order_id?: string | null
          order_ref?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message?: string
          order_id?: string | null
          order_ref?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_bundles: {
        Row: {
          agent_price: number
          bundle_size: string
          cost_price: number | null
          created_at: string
          general_price: number
          id: string
          network_id: string
          size_gb: number
        }
        Insert: {
          agent_price: number
          bundle_size: string
          cost_price?: number | null
          created_at?: string
          general_price: number
          id?: string
          network_id: string
          size_gb: number
        }
        Update: {
          agent_price?: number
          bundle_size?: string
          cost_price?: number | null
          created_at?: string
          general_price?: number
          id?: string
          network_id?: string
          size_gb?: number
        }
        Relationships: []
      }
      customer_reseller_links: {
        Row: {
          created_at: string | null
          customer_id: string
          id: string
          reseller_id: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          id?: string
          reseller_id: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          id?: string
          reseller_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      hidden_bundles: {
        Row: {
          bundle_size: string
          created_at: string
          id: string
          network_id: string
          status: string
        }
        Insert: {
          bundle_size: string
          created_at?: string
          id?: string
          network_id: string
          status?: string
        }
        Update: {
          bundle_size?: string
          created_at?: string
          id?: string
          network_id?: string
          status?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount: number
          bundle_size: string
          created_at: string
          gh_reference: string | null
          id: string
          network: string
          order_ref: string
          payment_method: string
          phone_number: string
          profit_credited: boolean
          reseller_profit: number
          status: string
          store_id: string | null
          storefront_slug: string | null
          user_id: string
        }
        Insert: {
          amount: number
          bundle_size: string
          created_at?: string
          gh_reference?: string | null
          id?: string
          network: string
          order_ref: string
          payment_method?: string
          phone_number: string
          profit_credited?: boolean
          reseller_profit?: number
          status?: string
          store_id?: string | null
          storefront_slug?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          bundle_size?: string
          created_at?: string
          gh_reference?: string | null
          id?: string
          network?: string
          order_ref?: string
          payment_method?: string
          phone_number?: string
          profit_credited?: boolean
          reseller_profit?: number
          status?: string
          store_id?: string | null
          storefront_slug?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agent_code: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_blocked: boolean
          phone: string
          referral_code: string | null
          tier: string
          topup_reference_code: string | null
          updated_at: string
          user_id: string
          wallet_balance: number
        }
        Insert: {
          agent_code?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id: string
          is_blocked?: boolean
          phone?: string
          referral_code?: string | null
          tier?: string
          topup_reference_code?: string | null
          updated_at?: string
          user_id: string
          wallet_balance?: number
        }
        Update: {
          agent_code?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_blocked?: boolean
          phone?: string
          referral_code?: string | null
          tier?: string
          topup_reference_code?: string | null
          updated_at?: string
          user_id?: string
          wallet_balance?: number
        }
        Relationships: []
      }
      promotions: {
        Row: {
          created_at: string
          description: string
          discount_percent: number
          expires_at: string
          id: string
          is_active: boolean
          starts_at: string
          target_audience: string
        }
        Insert: {
          created_at?: string
          description?: string
          discount_percent: number
          expires_at: string
          id?: string
          is_active?: boolean
          starts_at?: string
          target_audience?: string
        }
        Update: {
          created_at?: string
          description?: string
          discount_percent?: number
          expires_at?: string
          id?: string
          is_active?: boolean
          starts_at?: string
          target_audience?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referral_code: string
          referred_id: string
          referrer_id: string
          reward_amount: number
          reward_paid: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code: string
          referred_id: string
          referrer_id: string
          reward_amount?: number
          reward_paid?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          referral_code?: string
          referred_id?: string
          referrer_id?: string
          reward_amount?: number
          reward_paid?: boolean
        }
        Relationships: []
      }
      reseller_bundle_prices: {
        Row: {
          bundle_size: string
          created_at: string
          id: string
          network_id: string
          price: number
          store_id: string
          updated_at: string
        }
        Insert: {
          bundle_size: string
          created_at?: string
          id?: string
          network_id: string
          price: number
          store_id: string
          updated_at?: string
        }
        Update: {
          bundle_size?: string
          created_at?: string
          id?: string
          network_id?: string
          price?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_bundle_prices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "public_reseller_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_bundle_prices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "reseller_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_markups: {
        Row: {
          created_at: string
          id: string
          kind: string
          percent: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          percent?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          percent?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_markups_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "public_reseller_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_markups_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "reseller_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_prices: {
        Row: {
          bundle_size: string
          created_at: string | null
          id: string
          network: string
          price: number
          store_id: string
          updated_at: string | null
        }
        Insert: {
          bundle_size: string
          created_at?: string | null
          id?: string
          network: string
          price: number
          store_id: string
          updated_at?: string | null
        }
        Update: {
          bundle_size?: string
          created_at?: string | null
          id?: string
          network?: string
          price?: number
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reseller_prices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "public_reseller_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_prices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "reseller_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_stores: {
        Row: {
          available_profit: number
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          lifetime_profit: number
          slug: string
          store_message: string
          updated_at: string
          user_id: string
          whatsapp: string
        }
        Insert: {
          available_profit?: number
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          lifetime_profit?: number
          slug?: string
          store_message?: string
          updated_at?: string
          user_id: string
          whatsapp?: string
        }
        Update: {
          available_profit?: number
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          lifetime_profit?: number
          slug?: string
          store_message?: string
          updated_at?: string
          user_id?: string
          whatsapp?: string
        }
        Relationships: []
      }
      site_messages: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          message: string
          show_as_banner: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          message?: string
          show_as_banner?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          message?: string
          show_as_banner?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      store_referrals: {
        Row: {
          created_at: string
          id: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_referrals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "public_reseller_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_referrals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "reseller_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      telegram_bot_state: {
        Row: {
          id: number
          update_offset: number
          updated_at: string
        }
        Insert: {
          id: number
          update_offset?: number
          updated_at?: string
        }
        Update: {
          id?: number
          update_offset?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_messages: {
        Row: {
          chat_id: number
          created_at: string
          processed: boolean
          raw_update: Json
          text: string | null
          update_id: number
        }
        Insert: {
          chat_id: number
          created_at?: string
          processed?: boolean
          raw_update: Json
          text?: string | null
          update_id: number
        }
        Update: {
          chat_id?: number
          created_at?: string
          processed?: boolean
          raw_update?: Json
          text?: string | null
          update_id?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string
          id?: string
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      verified_topups: {
        Row: {
          amount: number
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          id: string
          is_claimed: boolean
          network: string
          transaction_id: string
        }
        Insert: {
          amount: number
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          id?: string
          is_claimed?: boolean
          network: string
          transaction_id: string
        }
        Update: {
          amount?: number
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          id?: string
          is_claimed?: boolean
          network?: string
          transaction_id?: string
        }
        Relationships: []
      }
      wallet_topups: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          paystack_reference: string | null
          screenshot_url: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method: string
          paystack_reference?: string | null
          screenshot_url?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          paystack_reference?: string | null
          screenshot_url?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_notes: string
          amount: number
          created_at: string
          fee_amount: number
          id: string
          momo_name: string
          momo_number: string
          net_amount: number
          network: string
          status: string
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string
          amount: number
          created_at?: string
          fee_amount?: number
          id?: string
          momo_name?: string
          momo_number: string
          net_amount?: number
          network?: string
          status?: string
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string
          amount?: number
          created_at?: string
          fee_amount?: number
          id?: string
          momo_name?: string
          momo_number?: string
          net_amount?: number
          network?: string
          status?: string
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "public_reseller_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "reseller_stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      custom_bundles_public: {
        Row: {
          agent_price: number | null
          bundle_size: string | null
          created_at: string | null
          general_price: number | null
          id: string | null
          network_id: string | null
          size_gb: number | null
        }
        Insert: {
          agent_price?: never
          bundle_size?: string | null
          created_at?: string | null
          general_price?: number | null
          id?: string | null
          network_id?: string | null
          size_gb?: number | null
        }
        Update: {
          agent_price?: never
          bundle_size?: string | null
          created_at?: string | null
          general_price?: number | null
          id?: string | null
          network_id?: string | null
          size_gb?: number | null
        }
        Relationships: []
      }
      public_reseller_stores: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          slug: string | null
          store_message: string | null
          updated_at: string | null
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          slug?: string | null
          store_message?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          slug?: string | null
          store_message?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_reseller_profit_direct: {
        Args: { p_amount: number; p_user_id: string }
        Returns: number
      }
      admin_approve_withdrawal: {
        Args: { p_id: string; p_notes?: string }
        Returns: undefined
      }
      admin_create_store: {
        Args: {
          p_full_name: string
          p_slug: string
          p_store_message: string
          p_user_id: string
          p_whatsapp: string
        }
        Returns: Json
      }
      admin_get_auto_deliver_minutes: { Args: never; Returns: number }
      admin_get_store_profits: {
        Args: never
        Returns: {
          available_profit: number
          lifetime_profit: number
          store_id: string
          user_id: string
        }[]
      }
      admin_mark_withdrawal_paid: {
        Args: { p_id: string; p_notes?: string }
        Returns: undefined
      }
      admin_reject_withdrawal: {
        Args: { p_id: string; p_notes?: string }
        Returns: undefined
      }
      admin_set_auto_deliver_minutes: {
        Args: { p_minutes: number }
        Returns: undefined
      }
      admin_set_user_tier: {
        Args: { new_tier: string; target_user_id: string }
        Returns: undefined
      }
      admin_toggle_admin_role: {
        Args: { make_admin: boolean; target_user_id: string }
        Returns: undefined
      }
      admin_toggle_block: {
        Args: { block_status: boolean; target_user_id: string }
        Returns: undefined
      }
      admin_update_order_status: {
        Args: { new_status: string; order_id: string }
        Returns: undefined
      }
      admin_wallet_operation: {
        Args: {
          operation_amount: number
          operation_description?: string
          operation_type: string
          target_user_id: string
        }
        Returns: undefined
      }
      api_place_order_for_user: {
        Args: {
          p_amount: number
          p_bundle: string
          p_network: string
          p_phone: string
          p_user_id: string
        }
        Returns: {
          order_id: string
          order_ref: string
        }[]
      }
      auto_claim_topup_by_reference: {
        Args: {
          p_amount: number
          p_network: string
          p_reference_code: string
          p_transaction_id: string
        }
        Returns: string
      }
      claim_verified_topup: {
        Args: { p_transaction_id: string }
        Returns: undefined
      }
      complete_paystack_topup: {
        Args: { p_amount: number; p_reference: string }
        Returns: undefined
      }
      complete_paystack_topup_for_user: {
        Args: { p_amount: number; p_reference: string; p_user_id: string }
        Returns: undefined
      }
      create_my_store: {
        Args: {
          p_full_name: string
          p_slug: string
          p_store_message: string
          p_whatsapp: string
        }
        Returns: string
      }
      create_user_profile: {
        Args: {
          p_email: string
          p_full_name: string
          p_phone?: string
          p_tier?: string
          p_user_id: string
        }
        Returns: undefined
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      force_update_reseller_profit: {
        Args: { p_amount: number; p_user_id: string }
        Returns: Json
      }
      generate_topup_reference_code: { Args: never; Returns: string }
      get_my_store_profit: {
        Args: never
        Returns: {
          available_profit: number
          lifetime_profit: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      kill_idle_connections: { Args: never; Returns: undefined }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      next_order_ref: { Args: never; Returns: string }
      pay_order_with_paystack: {
        Args: {
          p_amount: number
          p_bundle: string
          p_network: string
          p_phone: string
          p_reference: string
        }
        Returns: string
      }
      pay_order_with_paystack_for_user: {
        Args: {
          p_amount: number
          p_bundle: string
          p_network: string
          p_phone: string
          p_reference: string
          p_user_id: string
        }
        Returns: string
      }
      pay_with_wallet: {
        Args: {
          p_amount: number
          p_bundle: string
          p_network: string
          p_phone: string
          p_profit?: number
          p_store_id?: string
        }
        Returns: string
      }
      process_pending_orders: { Args: never; Returns: undefined }
      process_reseller_sale: {
        Args: {
          p_bundle_size: string
          p_network_id: string
          p_quantity?: number
          p_reseller_email: string
        }
        Returns: {
          admin_cost: number
          admin_profit: number
          customer_pays: number
          reseller_earns: number
          reseller_new_balance: number
        }[]
      }
      process_reseller_sale_safe: {
        Args: {
          p_bundle_size: string
          p_network_id: string
          p_quantity?: number
          p_reseller_email: string
        }
        Returns: {
          message: string
          new_balance: number
          reseller_earned: number
          success: boolean
        }[]
      }
      process_sale_and_add_profit: {
        Args: {
          p_bundle_size: string
          p_customer_email: string
          p_network_id: string
          p_quantity?: number
          p_reseller_email: string
        }
        Returns: {
          customer_paid: number
          message: string
          reseller_new_balance: number
          reseller_profit: number
          success: boolean
        }[]
      }
      process_sale_final: {
        Args: {
          p_bundle_size: string
          p_network_id: string
          p_quantity?: number
          p_reseller_email: string
        }
        Returns: Json
      }
      provision_my_profile: { Args: never; Returns: undefined }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      refund_failed_order: { Args: { p_order_id: string }; Returns: undefined }
      register_referral: { Args: { p_code: string }; Returns: undefined }
      register_store_referral: { Args: { p_slug: string }; Returns: undefined }
      request_withdrawal: {
        Args: {
          p_amount: number
          p_momo_name: string
          p_momo_number: string
          p_network: string
        }
        Returns: string
      }
      run_auto_deliver: { Args: never; Returns: number }
      safe_update_reseller_profit: {
        Args: { p_amount: number; p_user_id: string }
        Returns: number
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
      app_role: ["admin", "user"],
    },
  },
} as const
