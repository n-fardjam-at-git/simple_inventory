export type CustomerProcessOrder = {
  id: string;
  order_no: number;
  created_date: string | null;
  customer: string;
  start_date: string | null;
  cancel_date: string | null;
  status: string;
  left_to_ship: number;
  future_season: string | null;
  terms: string | null;
  shipping_method: string | null;
  ship_to: string[];
  bill_to: string[];
  po_no: string | null;
};
