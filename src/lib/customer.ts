export function addressPickLabel(address: {
  location_name: string | null;
  address_type: string;
  city: string | null;
  address_line1: string | null;
}) {
  const name = address.location_name?.trim() || address.address_type;
  const place = [address.city, address.address_line1]
    .map((part) => part?.trim() || "")
    .filter(Boolean)
    .join(", ");
  return place ? `${name} • ${place}` : name;
}

export function customerPickLabel(customer: {
  account_no: number;
  company_name: string;
  account_number: string | null;
}) {
  const sage = customer.account_number ? ` (${customer.account_number})` : "";
  return `${customer.account_no} · ${customer.company_name}${sage}`;
}
