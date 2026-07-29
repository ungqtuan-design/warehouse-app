export const suppliers = [
  {
    id: "sup-ims",
    name: "Inventory Management Solutions",
    contactName: "Tina Tran",
    phone: "+84 90 123 4567",
    email: "ims@example.com",
    address: "Binh Duong, Vietnam",
    isActive: true,
  },
  {
    id: "sup-packline",
    name: "Packline Engineering",
    contactName: "Minh Pham",
    phone: "+84 91 333 4444",
    email: "packline@example.com",
    address: "Ho Chi Minh City, Vietnam",
    isActive: true,
  },
  {
    id: "sup-oldtech",
    name: "OldTech Supply",
    contactName: "Linh Nguyen",
    phone: "+84 93 888 9999",
    email: "oldtech@example.com",
    address: "Hanoi, Vietnam",
    isActive: false,
  },
];

export const products = [
  {
    id: "prod-1",
    sku: "SKU-000128",
    name: "Seal bar",
    supplierName: "Inventory Management Solutions",
    status: "Active",
    isObsolete: false,
    khoTongQty: 24,
    khoLeQty: 6,
    outbound30d: 18,
  },
  {
    id: "prod-2",
    sku: "SKU-000129",
    name: "Vacuum nozzle",
    supplierName: "Packline Engineering",
    status: "Active",
    isObsolete: false,
    khoTongQty: 4,
    khoLeQty: 2,
    outbound30d: 21,
  },
  {
    id: "prod-3",
    sku: "SKU-000130",
    name: "Conveyor sensor",
    supplierName: "OldTech Supply",
    status: "Inactive",
    isObsolete: true,
    khoTongQty: 0,
    khoLeQty: 1,
    outbound30d: 3,
  },
];

export const inboundDraftLines = [
  {
    product: "Seal bar",
    supplier: "Inventory Management Solutions",
    quantity: 8,
    destination: "kho tong",
    note: "Manufacturer shipment July batch",
  },
  {
    product: "Vacuum nozzle",
    supplier: "Packline Engineering",
    quantity: 12,
    destination: "kho tong",
    note: "Safety stock refill",
  },
];

export const basketDraftLines = [
  {
    sku: "SKU-000128",
    product: "Seal bar",
    source: "kho le",
    available: 6,
    quantity: 2,
    customer: "Intel AFO line",
  },
  {
    sku: "SKU-000129",
    product: "Vacuum nozzle",
    source: "kho le",
    available: 2,
    quantity: 1,
    customer: "Packaging cell 03",
  },
];
