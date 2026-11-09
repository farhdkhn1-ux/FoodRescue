export interface Category {
  id: number;
  name: string;
  created_at?: string;
}

export type FoodType = "sale" | "donation";
export type PickupMethod = "pickup" | "delivery" | "both";
export type FoodStatus = "available" | "sold_out";

export type FoodCondition =
  | "layak"
  | "segar"
  | "fermentasi"
  | "kering"
  | "basah"
  | "afkir";

export type FoodUnit = "kg" | "gram" | "liter" | "karung" | "ember" | "porsi";

export interface SellerPublicProfile {
  id: string;
  store_name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone?: string | null;
  is_phone_public?: boolean;
  is_location_complete?: boolean;
}

export interface FoodItem {
  id: number;
  seller_id: string;
  category_id: number;
  name: string;
  description: string;
  image_url: string | null;
  quantity: number;
  unit?: string;
  price: number;
  type: FoodType;
  condition?: FoodCondition;
  target_livestock?: string | null;
  storage_instructions?: string | null;
  collected_at?: string | null;
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
  seller_profile?: SellerPublicProfile | null;
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
  seller_profile?: SellerPublicProfile | null;
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
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  seller_info?: SellerPublicProfile | null;
}

export interface ActionResponse<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}
