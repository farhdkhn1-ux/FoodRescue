export interface Category {
  id: number;
  name: string;
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
}

export interface ActionResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: unknown;
}
