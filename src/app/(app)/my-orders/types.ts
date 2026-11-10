import type { Cell, MatrixDrop, MatrixSize } from "@/components/matrix/QtyMatrix";

export type RequestOrder = {
  id: string;
  request_no: number;
  status: string;
  created_at: string;
  future_season: string | null;
  start_date: string | null;
  cancel_date: string | null;
  notes: string | null;
  ship: string[];
  bill: string[];
};

export type RequestLine = {
  request_id: string;
  product_id: string;
  name: string;
  price: number;
  sizes: MatrixSize[];
  drops: MatrixDrop[];
  cells: Cell[];
};

export type RequestAddress = {
  id: string;
  address_type: string;
  location_name: string | null;
  city: string | null;
  address_line1: string | null;
};
