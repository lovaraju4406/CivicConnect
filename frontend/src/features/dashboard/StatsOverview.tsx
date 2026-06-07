import { useSelector } from "react-redux";
import type { RootState } from "../../store";

export default function StatsOverview() {
  const complaints = useSelector((state: RootState) => state.complaints.complaints);

  const pending = complaints.filter(c => c.status === "Pending").length;
  const assigned = complaints.filter(c => c.status === "Assigned").length;
  const resolved = complaints.filter(c => c.status === "Resolved").length;

  return (
    <div className="grid md:grid-cols-3 gap-6">

      <StatCard
        title="Pending Complaints"
        value={pending}
        color="yellow"
      />

      <StatCard
        title="Assigned Complaints"
        value={assigned}
        color="blue"
      />

      <StatCard
        title="Resolved Complaints"
        value={resolved}
        color="green"
      />

    </div>
  );
}

function StatCard({
  title,
  value,
  color
}: {
  title: string;
  value: number;
  color: "yellow" | "blue" | "green";
}) {

  const colors = {
    yellow: "bg-yellow-100 text-yellow-800",
    blue: "bg-blue-100 text-blue-800",
    green: "bg-green-100 text-green-800"
  };

  return (
    <div className="bg-white rounded-2xl shadow-md p-6 text-center">
      <h3 className="text-gray-500">{title}</h3>
      <p className={`text-4xl font-bold mt-3 px-4 py-2 rounded-xl inline-block ${colors[color]}`}>
        {value}
      </p>
    </div>
  );
}