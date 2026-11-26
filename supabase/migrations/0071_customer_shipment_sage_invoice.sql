-- The Sage invoice for a customer shipment.
-- Text, like customers.account_number: a Sage number can carry a prefix or leading zeros.
-- Blank is not stored; no invoice yet is null.
-- The invoice is entered after the goods ship, so a shipped shipment can still change it,
-- the same as the tracking number and the notes.

alter table public.customer_shipments
  add column if not exists sage_invoice_no text;

alter table public.customer_shipments
  drop constraint if exists customer_shipments_sage_invoice_no_not_blank;

alter table public.customer_shipments
  add constraint customer_shipments_sage_invoice_no_not_blank
  check (sage_invoice_no is null or btrim(sage_invoice_no) <> '');

create or replace function public.customer_shipments_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_lines boolean;
  has_orders boolean;
begin
  if tg_op = 'DELETE' then
    if old.status = 'shipped' then
      raise exception 'A shipped shipment cannot be deleted';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'pending' then
      raise exception 'A shipment starts as pending';
    end if;
    new.date_shipped := null;
    new.created_by := auth.uid();
  else
    new.shipment_no := old.shipment_no;
    new.created_at := old.created_at;
    new.created_by := old.created_by;

    if old.status = 'canceled' then
      raise exception 'A canceled shipment cannot be changed';
    end if;

    if old.status = 'shipped' then
      if (to_jsonb(new) - 'tracking_no' - 'notes' - 'sage_invoice_no' - 'updated_at' - 'updated_by')
         is distinct from
         (to_jsonb(old) - 'tracking_no' - 'notes' - 'sage_invoice_no' - 'updated_at' - 'updated_by') then
        raise exception 'A shipped shipment cannot be changed';
      end if;
    else
      if new.status = 'shipped' then
        if coalesce(current_setting('app.customer_shipping', true), '') <> '1' then
          raise exception 'Use Ship to ship a shipment';
        end if;
        if new.date_shipped is null then
          new.date_shipped := current_date;
        end if;
      else
        new.date_shipped := null;
      end if;

      select
        exists (
          select 1
          from public.customer_shipment_products sp
          where sp.customer_shipment_id = old.id
        ),
        exists (
          select 1
          from public.customer_shipment_products sp
          where sp.customer_shipment_id = old.id
            and sp.customer_order_id is not null
        )
      into has_lines, has_orders;

      if has_lines and new.customer_id is distinct from old.customer_id then
        raise exception 'Remove the products before changing the customer';
      end if;

      if has_orders and row(
        new.terms, new.shipment_method_id, new.shipping_method, new.sales_rep_id,
        new.ship_address_line1, new.ship_address_line2, new.ship_city,
        new.ship_region, new.ship_postal_code, new.ship_country,
        new.bill_address_line1, new.bill_address_line2, new.bill_city,
        new.bill_region, new.bill_postal_code, new.bill_country
      ) is distinct from row(
        old.terms, old.shipment_method_id, old.shipping_method, old.sales_rep_id,
        old.ship_address_line1, old.ship_address_line2, old.ship_city,
        old.ship_region, old.ship_postal_code, old.ship_country,
        old.bill_address_line1, old.bill_address_line2, old.bill_city,
        old.bill_region, old.bill_postal_code, old.bill_country
      ) then
        raise exception 'Remove the orders before changing the addresses, terms, shipping method, or sales rep';
      end if;
    end if;
  end if;

  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

notify pgrst, 'reload schema';
