import React, { useState, useEffect } from "react";
import { Search, UserCircle, Mail, Phone, BookOpen } from "lucide-react";
import api from "../../services/api";
import StudentProfileSlideOver from "./StudentProfileSlideOver";
const HostelStudentsList = ({ hostelId }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const params = { limit: 50, page, user_type: "student" };
        if (hostelId) params.hostel_id = hostelId;
        if (searchQuery.trim()) params.search = searchQuery.trim();

        const res = await api.get("/users", { params });
        const result = res.data?.data;
        setStudents(Array.isArray(result?.users) ? result.users : []);
        setTotalPages(result?.total_pages || 1);
        setTotalStudents(result?.total || 0);
      } catch (err) {
        console.error("Failed to fetch hostel students", err);
      }
      setLoading(false);
    };

    // Simple debounce
    const timeout = setTimeout(fetchStudents, 300);
    return () => clearTimeout(timeout);
  }, [hostelId, page, searchQuery]);

  return (
    <div className="bg-white border border-[var(--border-light)] rounded-xl shadow-sm overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-slate-50 border-b border-[var(--border-light)] px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="font-bold text-[#0a2342] text-lg">
            Hostel Students Directory
          </h3>
          <p className="text-sm text-gray-500">
            Total {totalStudents} students assigned to this hostel
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search by name, email, or roll no..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1); // Reset to first page on search
            }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#f5bd19] focus:ring-1 focus:ring-[#f5bd19] transition-all bg-white shadow-sm"
          />
          <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white border-b border-gray-200">
            <tr className="text-xs uppercase tracking-wider text-gray-500 font-bold">
              <th className="p-4">Student</th>
              <th className="p-4">Contact</th>
              <th className="p-4">Academics</th>
              <th className="p-4">RFID Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && students.length === 0 ? (
              <tr>
                <td
                  colSpan="4"
                  className="p-12 text-center text-gray-400 font-medium"
                >
                  Loading students...
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td
                  colSpan="4"
                  className="p-12 text-center text-gray-400 font-medium"
                >
                  No students found.
                </td>
              </tr>
            ) : (
              students.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setSelectedStudent(s)}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[#f5bd19]/20 text-[#f5bd19] flex items-center justify-center">
                        <UserCircle size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-[#0a2342]">
                          {s.profile?.full_name ||
                            s.full_name ||
                            "Unnamed student"}
                        </p>
                        <p className="text-xs text-gray-500 font-mono">
                          Roll: {s.profile?.roll_number || "N/A"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail size={14} className="text-gray-400" />
                        {s.email}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone size={14} className="text-gray-400" />
                        {s.phone || "N/A"}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <BookOpen size={14} className="text-gray-400" />
                        {s.profile?.course || "N/A"}
                      </div>
                      <div className="text-xs text-gray-500">
                        Semester: {s.profile?.semester || "N/A"}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    {s.active_rfid ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-black rounded-full uppercase">
                        Assigned
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-black rounded-full uppercase">
                        Not Assigned
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm font-bold border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm font-bold text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 text-sm font-bold border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {selectedStudent && (
        <StudentProfileSlideOver
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onUpdate={() => {
            // Trigger a re-fetch
            setPage((p) => p);
            // We can cheat the fetch trigger by adding a timestamp state or just doing this
            setSearchQuery(searchQuery + " ");
            setTimeout(() => setSearchQuery(searchQuery), 0);
          }}
        />
      )}
    </div>
  );
};

export default HostelStudentsList;
