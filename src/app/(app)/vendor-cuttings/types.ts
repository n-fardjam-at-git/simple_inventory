import type { Cell, MatrixDrop, MatrixSize } from "@/components/matrix/QtyMatrix";

export type VendorCuttingRow = {
  id: string;
  order_num: number;
  date_submitted: string;
  open: boolean;
  brand: string | null;
};

export type VendorCuttingLine = {
  id: string;
  cutting_order_id: string;
  product_id: string;
  product_label: string;
  bulk_order_qty: number | null;
  sizes: MatrixSize[];
  drops: MatrixDrop[];
  cells: Cell[];
};
