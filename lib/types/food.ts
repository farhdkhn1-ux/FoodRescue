export interface Category {
  id: number;
  name: string;
  created_at?: string;
}

export type FoodType = "sale" | "donation";
export type PickupMethod = "pickup" | "delivery" | "both";
export type FoodStatus = "available" | "sold_out";

export interface FoodItem {
  id: number;
  seller_id: string;
  category_id: number;
  name: string;
  description: string;
  image_url: string | null;
  quantity: number;
  price: number;
  type: FoodType;
  available_from?: string | null;
  available_until?: string | null;
  pickup_method: PickupMethod;
  status: FoodStatus;
  created_at?: string;
  categories?: {
    name: string;
  } | null;
  seller?: {
    name?: string | null;
    address?: string | null;
    phone?: string | null;
  } | null;
}

export type OrderStatus = "pending" | "confirmed" | "completed" | "cancelled";

export interface OrderItem {
  id: number;
  order_id: number;
  food_id: number;
  seller_id: string;
  quantity: number;
  price: number;
  subtotal: number;
  food?: FoodItem;
}

export interface Order {
  id: number;
  buyer_id: string;
  total_amount: number;
  status: OrderStatus;
  pickup_method: "pickup" | "delivery";
  shipping_address?: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
  buyer?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
}

export interface ActionResponse<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}
