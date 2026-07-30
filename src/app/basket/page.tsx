import { BasketWorkspace } from "@/components/basket-workspace";
import { getBasketRows } from "@/lib/warehouse-data";
import { requireUser } from "@/lib/auth";
import { getUiContext } from "@/lib/ui";

export default async function BasketPage() {
  await requireUser();

  const [basketRows, { text }] = await Promise.all([getBasketRows(), getUiContext()]);

  return <BasketWorkspace text={text} historyRows={basketRows} />;
}
