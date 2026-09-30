import { BasketWorkspace } from "@/components/basket-workspace";
import { getBasketRows } from "@/lib/warehouse-data";
import { requireUser } from "@/lib/auth";
import { uiText as text } from "@/lib/ui";

export default async function BasketPage() {
  await requireUser();

  const basketRows = await getBasketRows();

  return <BasketWorkspace text={text} historyRows={basketRows} />;
}
