import { createClient } from "@/lib/supabase/server";
import { requireRoles } from "@/lib/auth";
import type { MatrixDrop, MatrixSize } from "@/components/matrix/QtyMatrix";
import { SHIPPABLE_ORDER_STATUS } from "@/lib/customer-shipment";
import { PRODUCT_TYPE, productTypeLabel } from "@/lib/product-type";
import { CustomerShipmentsWorkspace } from "./CustomerShipmentsWorkspace";
import type { CustomerShipmentRow } from "./CustomerShipmentsTable";
import type { ShipmentCell, ShipmentLine } from "./ShipmentProductsPanel";

function one<T>(raw: unknown): T | null {
  return (Array.isArray(raw) ? raw[0] : raw) as T | null;
}

function addressLines(shipment: Record<string, unknown>, prefix: "ship" | "bill") {
  const text = (key: string) => {
    const value = shipment[`${prefix}_${key}`];
    return typeof value === "string" ? value.trim() : "";
  };
  const cityLine = [text("city"), [text("region"), text("postal_code")].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [text("address_line1"), text("address_line2"), cityLine, text("country")].filter(Boolean);
}

export default async function CustomerShipmentsPage({
  searchParams,
}: {
  /** From the pick list: the shipment to select. */
  searchParams: Promise<{ shipment?: string }>;
}) {
  const { shipment: focusShipmentId } = await searchParams;
  const profile = await requireRoles(["admin", "warehouse", "sales_rep"]);
  const canWrite = profile.role === "admin" || profile.role === "warehouse";
  const supabase = await createClient();

  const [{ data: shipments }, { data: lineRows }] = await Promise.all([
    supabase
      .from("customer_shipments")
      .select("*, customers ( account_no, company_name, account_number )")
      .order("shipment_no", { ascending: false }),
    supabase
      .from("customer_shipment_products")
      .select(
        "id, customer_shipment_id, product_id, qty, price, products ( type, name, models ( name, items ( name ) ) ), customer_orders ( order_no ), customer_shipment_cells ( size_id, drop_id, qty, price )",
      ),
  ]);

  const peopleIds = [
    ...new Set(
      (shipments ?? [])
        .flatMap((shipment) => [
          shipment.sales_rep_id,
          shipment.picker_id,
          shipment.created_by,
          shipment.updated_by,
        ])
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const productIds = [...new Set((lineRows ?? []).map((line) => line.product_id))];

  const [{ data: people }, { data: sizeRows }, { data: dropRows }] = await Promise.all([
    peopleIds.length
      ? supabase.from("profiles").select("id, display_name").in("id", peopleIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
    productIds.length
      ? supabase
          .from("product_sizes")
          .select("product_id, size_chart_sizes ( id, code, sort_order )")
          .in("product_id", productIds)
      : Promise.resolve({ data: [] as { product_id: string; size_chart_sizes: unknown }[] }),
    productIds.length
      ? supabase
          .from("product_drops")
          .select("product_id, size_chart_drops ( id, code, sort_order )")
          .in("product_id", productIds)
      : Promise.resolve({ data: [] as { product_id: string; size_chart_drops: unknown }[] }),
  ]);
  const personName = (id: string | null) =>
    (people ?? []).find((person) => person.id === id)?.display_name?.trim() || null;

  const [{ data: customers }, { data: pickers }, { data: orders }, { data: charges }] = canWrite
    ? await Promise.all([
        supabase
          .from("customers")
          .select("id, account_no, company_name, account_number")
          .eq("is_active", true)
          .order("company_name"),
        supabase
          .from("profiles")
          .select("id, display_name")
          .in("role", ["admin", "warehouse"])
          .order("display_name"),
        supabase
          .from("customer_orders")
          .select("id, order_no, po_no, customer_id")
          .in("status", [...SHIPPABLE_ORDER_STATUS])
          .order("order_no"),
        supabase
          .from("products")
          .select("id, type, name")
          .in("type", [PRODUCT_TYPE.surcharge, PRODUCT_TYPE.freight])
          .eq("is_active", true)
          .order("type")
          .order("name"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const sizesByProduct = new Map<string, MatrixSize[]>();
  for (const row of sizeRows ?? []) {
    const size = one<MatrixSize>(row.size_chart_sizes);
    if (!size) continue;
    const list = sizesByProduct.get(row.product_id) ?? [];
    list.push(size);
    sizesByProduct.set(row.product_id, list);
  }
  const dropsByProduct = new Map<string, MatrixDrop[]>();
  for (const row of dropRows ?? []) {
    const drop = one<MatrixDrop>(row.size_chart_drops);
    if (!drop) continue;
    const list = dropsByProduct.get(row.product_id) ?? [];
    list.push(drop);
    dropsByProduct.set(row.product_id, list);
  }

  const ordersByShipment = new Map<string, Set<number>>();
  const lines: ShipmentLine[] = (lineRows ?? []).map((line) => {
    const product = one<{ type: number | null; name: string | null; models: unknown }>(line.products);
    const model = one<{ name: string | null; items: unknown }>(product?.models ?? null);
    const item = one<{ name: string | null }>(model?.items ?? null);
    const type = product?.type ?? PRODUCT_TYPE.merchandise;
    const merchandise = type === PRODUCT_TYPE.merchandise;
    const orderNo = one<{ order_no: number }>(line.customer_orders)?.order_no ?? null;
    if (orderNo != null) {
      const set = ordersByShipment.get(line.customer_shipment_id) ?? new Set<number>();
      set.add(orderNo);
      ordersByShipment.set(line.customer_shipment_id, set);
    }
    const cells: ShipmentCell[] = (
      (line.customer_shipment_cells ?? []) as {
        size_id: string;
        drop_id: string;
        qty: number | null;
        price: number | null;
      }[]
    ).map((cell) => ({
      size_id: cell.size_id,
      drop_id: cell.drop_id,
      qty: Number(cell.qty ?? 0),
      price: Number(cell.price ?? 0),
    }));
    // The grid shows only the sizes and drops that were left to ship on the order.
    const sizeIds = new Set(cells.map((cell) => cell.size_id));
    const dropIds = new Set(cells.map((cell) => cell.drop_id));
    return {
      id: line.id,
      customer_shipment_id: line.customer_shipment_id,
      order_no: orderNo,
      product_id: line.product_id,
      type,
      label:
        product?.name?.trim() || (merchandise ? model?.name?.trim() || "Product" : productTypeLabel(type)),
      item_name: merchandise ? item?.name?.trim() || "Item" : null,
      qty: Number(line.qty ?? 0),
      price: Number(line.price ?? 0),
      sizes: (sizesByProduct.get(line.product_id) ?? []).filter((size) => sizeIds.has(size.id)),
      drops: (dropsByProduct.get(line.product_id) ?? []).filter((drop) => dropIds.has(drop.id)),
      cells,
    };
  });

  const rows: CustomerShipmentRow[] = (shipments ?? []).map((shipment) => {
    const customer = one<{
      account_no: number;
      company_name: string;
      account_number: string | null;
    }>(shipment.customers);
    return {
      id: shipment.id,
      shipment_no: shipment.shipment_no,
      created_date: shipment.created_at ? String(shipment.created_at).slice(0, 10) : null,
      date_shipped: shipment.date_shipped ?? null,
      customer_id: shipment.customer_id,
      customer: customer?.company_name ?? "",
      account_no: customer?.account_no ?? null,
      account: customer?.account_number ?? null,
      status: shipment.status,
      orders: [...(ordersByShipment.get(shipment.id) ?? [])].sort((a, b) => a - b),
      terms: shipment.terms ?? null,
      shipping_method: shipment.shipping_method ?? null,
      sales_rep: personName(shipment.sales_rep_id),
      picker_id: shipment.picker_id ?? null,
      picker: personName(shipment.picker_id),
      created_by: personName(shipment.created_by),
      updated_by: personName(shipment.updated_by),
      tracking_no: shipment.tracking_no ?? null,
      sage_invoice_no: shipment.sage_invoice_no ?? null,
      notes: shipment.notes ?? null,
      ship_to: addressLines(shipment as Record<string, unknown>, "ship"),
      bill_to: addressLines(shipment as Record<string, unknown>, "bill"),
    };
  });

  return (
    <div>
      <CustomerShipmentsWorkspace
        rows={rows}
        lines={lines}
        focusId={rows.some((row) => row.id === focusShipmentId) ? (focusShipmentId ?? null) : null}
        canWrite={canWrite}
        customers={customers ?? []}
        pickers={(pickers ?? []).map((person) => ({
          id: person.id,
          label: person.display_name?.trim() || "Staff",
        }))}
        orders={(orders ?? []).map((order) => ({
          id: order.id,
          customer_id: order.customer_id,
          label: order.po_no
            ? `Order No ${order.order_no} · PO ${order.po_no}`
            : `Order No ${order.order_no}`,
        }))}
        charges={(charges ?? []).map((product) => ({
          id: product.id,
          label: product.name?.trim() || productTypeLabel(product.type),
        }))}
      />
    </div>
  );
}
