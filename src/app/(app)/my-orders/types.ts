import type { Cell, MatrixDrop, MatrixSize } from "@/components/matrix/QtyMatrix";

export type RequestOrder = {
  id: string;
  request_no: number;
  status: string;
  created_at: string;
  future_season: string | null;
  start_date: string | null;
  cancel_date: string | null;
  terms: string | null;
  shipping_method: string | null;
  notes: string | null;
  staff_reply: string | null;
  customer_acceptance: boolean | null;
  ship: string[];
  bill: string[];
};

export type RequestLine = {
  request_id: string;
  product_id: string;
  name: string;
  item: string | null;
  price: number;
  qty: number | null;
  type: number;
  sizes: MatrixSize[];
  drops: MatrixDrop[];
  cells: Cell[];
};

export type RequestCatalogChoice = { id: string; label: string; item_id: string | null };
export type RequestSetItem = { id: string; name: string };

export type RequestAddress = {
  id: string;
  address_type: string;
  location_name: string | null;
  city: string | null;
  address_line1: string | null;
};
