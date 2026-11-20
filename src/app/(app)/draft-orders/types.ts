import type { Cell, MatrixDrop, MatrixSize } from "@/components/matrix/QtyMatrix";
import type {
  OrderAddress,
  OrderCustomer,
  OrderSeason,
  OrderShipmentMethod,
  OrderTerm,
} from "../customer-orders/NewOrderForm";

export type DraftOrderRow = {
  id: string;
  request_no: number;
  customer_id: string;
  customer: string;
  account_no: number | null;
  account: string | null;
  sales_rep_id: string | null;
  sales_rep: string | null;
  created_at: string;
  future_season: string | null;
  start_date: string | null;
  cancel_date: string | null;
  terms: string | null;
  shipment_method_id: string | null;
  shipping_method: string | null;
  notes: string | null;
  staff_reply: string | null;
  customer_acceptance: boolean | null;
  status: string;
  ship: string[];
  bill: string[];
  ship_line1: string | null;
  ship_city: string | null;
  bill_line1: string | null;
  bill_city: string | null;
  /** Entered by a sales rep (Received via Online by sales rep), not by the customer in the shop. */
  rep_entered: boolean;
  customer_has_login: boolean;
};

/** What the Add proposal card needs. Null for a role that cannot enter a proposal. */
export type ProposalChoices = {
  customers: OrderCustomer[];
  addresses: OrderAddress[];
  shipmentMethods: OrderShipmentMethod[];
  seasons: OrderSeason[];
  terms: OrderTerm[];
};

export type DraftChoice = { id: string; label: string };

export type DraftMethod = DraftChoice & { active: boolean };

export type DraftOrderLine = {
  request_id: string;
  product_id: string;
  name: string;
  price: number;
  qty: number | null;
  type: number;
  item: string | null;
  item_id: string | null;
  size_chart_id: string | null;
  ordered: number;
  extended: number;
  sizes: MatrixSize[];
  drops: MatrixDrop[];
  cells: Cell[];
};
