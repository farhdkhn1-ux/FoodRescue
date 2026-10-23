"use server";

import {
  createOrderAction as _createOrderAction,
  cancelOrderAction as _cancelOrderAction,
  updateOrderStatusAction as _updateOrderStatusAction,
  type CreateOrderInput,
} from "@/app/actions/order";

export async function createOrderAction(input: CreateOrderInput) {
  return _createOrderAction(input);
}

export async function cancelOrderAction(
  orderId: number,
  reason?: string,
  restock?: boolean
) {
  return _cancelOrderAction(orderId, reason, restock);
}

export async function updateOrderStatusAction(
  orderId: number,
  targetStatus: "confirmed" | "completed"
) {
  return _updateOrderStatusAction(orderId, targetStatus);
}
