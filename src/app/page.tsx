import { appConfig } from "@/lib/config";

import { SalesConsoleApp } from "@/components/sales-console-app";

export default function Page() {
  return <SalesConsoleApp initialMode={appConfig.defaultMode} />;
}
