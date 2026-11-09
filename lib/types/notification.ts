export type NotificationType = "order_status" | "delivery" | "system";

export interface NotificationItem {
  id: number;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  order_id: number | null;
  is_read: boolean;
  metadata?: {
    status?: string;
    role?: "buyer" | "seller" | "courier";
    food_name?: string;
    quantity?: number;
    [key: string]: unknown;
  };
  created_at: string;
}

