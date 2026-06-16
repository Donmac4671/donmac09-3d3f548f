import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCanonical } from "@/hooks/useCanonical";

const API_BASE = `${typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : ""}`;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const FN_BASE = `${SUPABASE_URL}/functions/v1/public-api`;

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-muted/60 border border-border rounded-lg p-3 overflow-x-auto text-xs leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

function Endpoint({ method, path, color, title, children }: { method: string; path: string; color: string; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={color}>{method}</Badge>
        <code className="text-sm font-mono break-all">{path}</code>
      </div>
      <h3 className="font-semibold">{title}</h3>
      {children}
    </Card>
  );
}

export default function ApiDocs() {
  useCanonical("/api-docs");

  return (
    <DashboardLayout title="API Documentation">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        <Card className="p-5">
          <h2 className="text-xl font-bold mb-2">Donmac Data Hub — Public API</h2>
          <p className="text-sm text-muted-foreground">
            Place data orders on behalf of your customers from your own website. Orders are paid from your Donmac wallet.
          </p>
        </Card>

        <Card className="p-5 space-y-3">
          <h3 className="font-semibold">Base URL</h3>
          <Code>{FN_BASE}</Code>
          <h3 className="font-semibold pt-2">Authentication</h3>
          <p className="text-sm text-muted-foreground">
            Generate an API token in your <a href="/profile" className="text-primary underline">Profile → API Access</a>.
            Include it on every request (except <code>GET /networks</code>) using:
          </p>
          <Code>{`Authorization: Bearer dmh_live_xxxxxxxxxxxxxxxxxxxxxxxx`}</Code>
        </Card>

        <Endpoint method="GET" path="/networks" color="bg-blue-500 text-white" title="List available networks & bundles">
          <p className="text-sm text-muted-foreground">Public. No token required.</p>
          <Code>{`curl ${FN_BASE}/networks`}</Code>
          <Code>{`fetch("${FN_BASE}/networks").then(r => r.json())`}</Code>
        </Endpoint>

        <Endpoint method="GET" path="/wallet/balance" color="bg-blue-500 text-white" title="Check wallet balance">
          <Code>{`curl ${FN_BASE}/wallet/balance \\
  -H "Authorization: Bearer dmh_live_..."`}</Code>
          <p className="text-sm font-semibold pt-1">Response</p>
          <Code>{`{ "balance": 124.50, "currency": "GHS" }`}</Code>
        </Endpoint>

        <Endpoint method="POST" path="/orders" color="bg-green-600 text-white" title="Place an order">
          <p className="text-sm text-muted-foreground">Debits your wallet and queues delivery.</p>
          <p className="text-sm font-semibold">Body</p>
          <Code>{`{
  "network": "telecel",
  "phone":   "0201234567",
  "bundle":  "5GB"
}`}</Code>
          <Code>{`curl -X POST ${FN_BASE}/orders \\
  -H "Authorization: Bearer dmh_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"network":"telecel","phone":"0201234567","bundle":"5GB"}'`}</Code>
          <p className="text-sm font-semibold pt-1">Response (201)</p>
          <Code>{`{
  "order_ref": "DMH1234",
  "status":    "processing",
  "network":   "TELECEL",
  "bundle":    "5GB",
  "phone":     "0201234567",
  "amount":    21.20,
  "currency":  "GHS"
}`}</Code>
          <p className="text-xs text-muted-foreground">
            Save <code>order_ref</code> — use it to check status or match incoming webhook events.
          </p>
        </Endpoint>

        <Endpoint method="GET" path="/orders/:ref" color="bg-blue-500 text-white" title="Get order status">
          <Code>{`curl ${FN_BASE}/orders/DMH1234 \\
  -H "Authorization: Bearer dmh_live_..."`}</Code>
          <p className="text-sm font-semibold pt-1">Statuses</p>
          <p className="text-xs text-muted-foreground">
            <code>processing</code>, <code>pending</code>, <code>waiting</code>, <code>completed</code>, <code>failed</code>.
          </p>
        </Endpoint>

        <Card className="p-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">Webhooks</h3>
          <p className="text-sm text-muted-foreground">
            Configure a webhook URL in Profile → API Access. We POST JSON when an order's status changes.
            Each request includes header <code>X-Donmac-Signature</code> = <code>sha256=&lt;hex hmac of body using your secret&gt;</code>.
          </p>
          <p className="text-sm font-semibold">Payload</p>
          <Code>{`{
  "event":     "order.updated",
  "order_ref": "DMH1234",
  "status":    "completed",
  "network":   "TELECEL",
  "bundle":    "5GB",
  "phone":     "0201234567",
  "amount":    21.20,
  "timestamp": "2026-06-16T12:34:56Z"
}`}</Code>
          <p className="text-sm font-semibold pt-1">Node.js verification example</p>
          <Code>{`import crypto from "crypto";

const secret = process.env.DONMAC_WEBHOOK_SECRET;
const sig = req.headers["x-donmac-signature"];
const expected = "sha256=" + crypto.createHmac("sha256", secret)
  .update(rawBody).digest("hex");
if (sig !== expected) return res.status(401).end();`}</Code>
        </Card>

        <Card className="p-5 space-y-2">
          <h3 className="font-semibold">Errors</h3>
          <p className="text-sm text-muted-foreground">All errors return <code>{`{ "error": "..." }`}</code> with a 4xx/5xx status.</p>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            <li><b>401</b> — missing, invalid, or revoked token</li>
            <li><b>400</b> — bad input or insufficient wallet balance</li>
            <li><b>404</b> — order not found</li>
          </ul>
        </Card>

        <p className="text-xs text-muted-foreground text-center pb-6">
          App base: <code>{API_BASE}</code>
        </p>
      </div>
    </DashboardLayout>
  );
}
