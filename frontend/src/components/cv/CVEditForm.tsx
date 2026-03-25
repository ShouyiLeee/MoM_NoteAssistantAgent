import { useState } from "react";

export interface CVEditData {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  summary: string;
  skills: string[];
  experience_years: number | null;
  education: string;
  recent_roles: string[];
}

interface CVEditFormProps {
  initial: CVEditData;
  onSave: (data: CVEditData) => void;
  isSaving?: boolean;
}

export default function CVEditForm({ initial, onSave, isSaving = false }: CVEditFormProps) {
  const [data, setData] = useState<CVEditData>(initial);
  const [newSkill, setNewSkill] = useState("");
  const [newRole, setNewRole] = useState("");

  const set = (field: keyof CVEditData, value: unknown) =>
    setData((prev) => ({ ...prev, [field]: value }));

  const addSkill = () => {
    const s = newSkill.trim();
    if (s && !data.skills.includes(s)) {
      set("skills", [...data.skills, s]);
      setNewSkill("");
    }
  };

  const removeSkill = (skill: string) =>
    set("skills", data.skills.filter((s) => s !== skill));

  const addRole = () => {
    const r = newRole.trim();
    if (r) {
      set("recent_roles", [...data.recent_roles, r]);
      setNewRole("");
    }
  };

  const removeRole = (idx: number) =>
    set("recent_roles", data.recent_roles.filter((_, i) => i !== idx));

  return (
    <div className="space-y-6">
      {/* Name + Contact */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Full Name</label>
          <input className="input" value={data.name} onChange={(e) => set("name", e.target.value)} placeholder="John Doe" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={data.email} onChange={(e) => set("email", e.target.value)} placeholder="john@example.com" />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={data.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+84 xxx xxx xxx" />
        </div>
        <div>
          <label className="label">LinkedIn</label>
          <input className="input" value={data.linkedin} onChange={(e) => set("linkedin", e.target.value)} placeholder="linkedin.com/in/your-profile" />
        </div>
      </div>

      {/* Summary */}
      <div>
        <label className="label">Professional Summary</label>
        <textarea
          className="input min-h-[80px] resize-y"
          value={data.summary}
          onChange={(e) => set("summary", e.target.value)}
          placeholder="2-3 sentence professional summary..."
        />
      </div>

      {/* Experience + Education */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Years of Experience</label>
          <input
            className="input"
            type="number"
            min={0}
            max={50}
            value={data.experience_years ?? ""}
            onChange={(e) => set("experience_years", e.target.value ? parseInt(e.target.value) : null)}
            placeholder="e.g. 3"
          />
        </div>
        <div>
          <label className="label">Education</label>
          <input className="input" value={data.education} onChange={(e) => set("education", e.target.value)} placeholder="BSc Computer Science" />
        </div>
      </div>

      {/* Skills */}
      <div>
        <label className="label">Skills</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {data.skills.map((skill) => (
            <span key={skill} className="flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded-full">
              {skill}
              <button onClick={() => removeSkill(skill)} className="hover:text-red-600 ml-0.5">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
            placeholder="Add a skill and press Enter"
          />
          <button onClick={addSkill} className="btn-secondary px-4">Add</button>
        </div>
      </div>

      {/* Recent Roles */}
      <div>
        <label className="label">Recent Roles</label>
        <ul className="space-y-2 mb-2">
          {data.recent_roles.map((role, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{role}</span>
              <button onClick={() => removeRole(idx)} className="text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRole(); } }}
            placeholder='e.g. "Software Engineer at Google (2022)"'
          />
          <button onClick={addRole} className="btn-secondary px-4">Add</button>
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={() => onSave(data)}
        disabled={isSaving}
        className="btn-primary w-full py-3 text-base font-medium disabled:opacity-50"
      >
        {isSaving ? "Saving CV..." : "Save CV"}
      </button>
    </div>
  );
}
