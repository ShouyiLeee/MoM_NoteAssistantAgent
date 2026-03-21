import { useEffect, useState } from "react";
import Head from "next/head";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
} from "chart.js";
import { Doughnut, Bar, Line } from "react-chartjs-2";
import Layout from "@/components/layout/Layout";
import { fetchAnalytics, type AnalyticsResponse } from "@/lib/api";
import { getUserId } from "@/lib/user";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler
);

const RESULT_COLORS: Record<string, string> = {
  Pass: "#22c55e",
  Fail: "#ef4444",
  Pending: "#f59e0b",
};

const STAGE_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899"];

function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className={`card p-5 border-l-4 ${color}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />;
}

export default function DashboardPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const uid = getUserId();
    fetchAnalytics(uid)
      .then(setData)
      .catch(() => setError("Failed to load analytics. Make sure the backend is running."))
      .finally(() => setLoading(false));
  }, []);

  const doughnutData = data
    ? {
        labels: Object.keys(data.by_result),
        datasets: [
          {
            data: Object.values(data.by_result),
            backgroundColor: Object.keys(data.by_result).map(
              (k) => RESULT_COLORS[k] || "#94a3b8"
            ),
            borderWidth: 2,
            borderColor: "#fff",
          },
        ],
      }
    : null;

  const stageBarData = data
    ? {
        labels: Object.keys(data.by_stage),
        datasets: [
          {
            label: "Interviews",
            data: Object.values(data.by_stage).map((v) => v.total),
            backgroundColor: STAGE_COLORS,
            borderRadius: 6,
          },
        ],
      }
    : null;

  const companyBarData = data
    ? {
        labels: Object.keys(data.by_company),
        datasets: [
          {
            label: "Interviews",
            data: Object.values(data.by_company).map((v) => v.total),
            backgroundColor: "#3b82f6",
            borderRadius: 6,
          },
        ],
      }
    : null;

  const timelineData = data
    ? {
        labels: data.timeline.map((t) => t.month),
        datasets: [
          {
            label: "Interviews",
            data: data.timeline.map((t) => t.count),
            fill: true,
            backgroundColor: "rgba(59,130,246,0.1)",
            borderColor: "#3b82f6",
            pointBackgroundColor: "#3b82f6",
            tension: 0.4,
          },
        ],
      }
    : null;

  const chartOpts = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, grid: { color: "#f1f5f9" } },
    },
  };

  return (
    <>
      <Head>
        <title>Dashboard — Interview Note Agent</title>
      </Head>
      <Layout title="Dashboard">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Weakest stage insight */}
        {data?.weakest_stage && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-medium text-amber-800">Insight</p>
              <p className="text-sm text-amber-700">
                Your weakest stage is <strong>{data.weakest_stage}</strong>. Focus your
                practice on improving this area before your next interview.
              </p>
            </div>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {loading ? (
            <>
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </>
          ) : (
            <>
              <KpiCard
                label="Total Interviews"
                value={data?.total ?? 0}
                color="border-blue-500"
              />
              <KpiCard
                label="Pass Rate"
                value={`${(data?.pass_rate ?? 0).toFixed(1)}%`}
                sub={`${data?.by_result?.Pass ?? 0} passed`}
                color="border-green-500"
              />
              <KpiCard
                label="Companies"
                value={data?.by_company ? Object.keys(data.by_company).length : 0}
                color="border-purple-500"
              />
              <KpiCard
                label="Weakest Stage"
                value={data?.weakest_stage ?? "—"}
                color="border-red-400"
              />
            </>
          )}
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* Result doughnut */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-700 mb-4">Result Breakdown</h3>
            {loading ? (
              <Skeleton className="h-48" />
            ) : doughnutData ? (
              <div className="flex items-center justify-center">
                <div className="w-48 h-48 relative">
                  <Doughnut
                    data={doughnutData}
                    options={{
                      responsive: true,
                      cutout: "70%",
                      plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } },
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        {(data?.pass_rate ?? 0).toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-400">Pass</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
            )}
          </div>

          {/* Stage bar */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-700 mb-4">By Interview Stage</h3>
            {loading ? (
              <Skeleton className="h-48" />
            ) : stageBarData ? (
              <Bar data={stageBarData} options={chartOpts} />
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
            )}
          </div>

          {/* Company bar */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-700 mb-4">Top Companies</h3>
            {loading ? (
              <Skeleton className="h-48" />
            ) : companyBarData ? (
              <Bar data={companyBarData} options={{ ...chartOpts, indexAxis: "y" as const }} />
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-700 mb-4">Interview Activity Timeline</h3>
          {loading ? (
            <Skeleton className="h-40" />
          ) : timelineData ? (
            <Line data={timelineData} options={{ ...chartOpts, plugins: { legend: { display: false } } }} />
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
          )}
        </div>
      </Layout>
    </>
  );
}
