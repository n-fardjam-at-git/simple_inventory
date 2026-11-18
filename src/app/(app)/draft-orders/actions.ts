"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";

function revalidate() {
  revalidatePath("/draft-orders");
  revalidatePath("/customer-orders");
  revalidatePath("/my-orders");
}

export async function acceptOrderRequest(id: string) {
  await requireRoles(["admin", "warehouse"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_customer_order_request", { p_request_id: id });
  if (error) return error.message;
  revalidate();
  return null;
}

export async function saveStaffReply(id: string, reply: string) {
  await requireRoles(["admin", "warehouse", "sales_rep"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_request_staff_reply", {
    p_request_id: id,
    p_reply: reply,
  });
  if (error) return error.message;
  revalidate();
  return null;
}

export async function returnOrderRequest(id: string) {
  await requireRoles(["admin", "warehouse"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("return_customer_order_request", { p_request_id: id });
  if (error) return error.message;
  revalidate();
  return null;
}
