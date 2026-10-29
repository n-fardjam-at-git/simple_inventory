import type { Cell, MatrixDrop, MatrixSize } from "@/components/matrix/QtyMatrix";

export type CuttingViewRow = {
  id: string;
  shipment_id: string;
  cutting_order_id: string;
  product_id: string;
  order_num: number;
  product_label: string;
  sizes: MatrixSize[];
  drops: MatrixDrop[];
  cells: Cell[];
};

export type CatalogCutting = {
  id: string;
  order_num: number;
  vendor_id: string;
  status: boolean;
};

export type CatalogCuttingProduct = {
  cutting_order_id: string;
  product_id: string;
  label: string;
  status: boolean;
};
