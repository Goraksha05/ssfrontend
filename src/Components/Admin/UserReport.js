import React, { useEffect, useState } from 'react';
import { CSVLink } from 'react-csv';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AdminUserReport = () => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadType, setDownloadType] = useState('csv');

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setErrorMsg('No token found. Please login again.');
          setLoading(false);
          return;
        }

        const res = await fetch(`${BACKEND_URL}/api/admin/user-report`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        });

        const data = await res.json();
        console.log('[User Report Data]', data);

        if (res.ok && data.success) {
          setReportData(data.report);
        } else {
          setErrorMsg(data.message || 'Failed to fetch report');
        }
      } catch (error) {
        console.error('Fetch error:', error);
        setErrorMsg('Failed to load report. Server error.');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, []);

  const headers = [
    { label: 'Name', key: 'name' },
    { label: 'Email', key: 'email' },
    { label: 'Phone', key: 'phone' },
    { label: 'Username', key: 'username' },
    { label: 'Subscription Plan', key: 'subscription' },
    { label: 'Active', key: 'subscriptionActive' },
    { label: 'Start Date', key: 'subscriptionStart' },
    { label: 'Expiry Date', key: 'subscriptionExpiry' },
    { label: 'Referral Tokens', key: 'referralTokens' },
    { label: 'Post Milestones', key: 'postMilestoneSlabs' },
    { label: 'Redeemed Post Slabs', key: 'redeemedPostSlabs' },
    { label: 'Redeemed Referral Slabs', key: 'redeemedReferralSlabs' },
    { label: 'Redeemed Streak Slabs', key: 'redeemedStreakSlabs' },
  ];

  const handleDownload = () => {
    if (!reportData.length) return alert('No report data available.');

    if (downloadType === 'excel') {
      const worksheet = XLSX.utils.json_to_sheet(reportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'User Report');
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const file = new Blob([excelBuffer], { type: 'application/octet-stream' });
      saveAs(file, 'user-report.xlsx');
    } else if (downloadType === 'pdf') {
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text('User Report', 14, 15);
      const tableData = reportData.map(row => headers.map(h => row[h.key]));
      doc.autoTable({
        head: [headers.map(h => h.label)],
        body: tableData,
        startY: 20,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 0, 0] },
      });
      doc.save('user-report.pdf');
    }
  };

  return (
    <div className="container py-4">
      <h2 className="mb-3">📊 User Report</h2>

      {loading ? (
        <p>Loading report...</p>
      ) : errorMsg ? (
        <div className="alert alert-danger">{errorMsg}</div>
      ) : reportData.length === 0 ? (
        <div className="alert alert-warning">No users found in the report.</div>
      ) : (
        <>
          <div className="d-flex mb-3 align-items-center gap-2">
            <select
              className="form-select w-auto"
              value={downloadType}
              onChange={(e) => setDownloadType(e.target.value)}
            >
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
              <option value="pdf">PDF</option>
            </select>

            {downloadType === 'csv' ? (
              <CSVLink
                data={reportData}
                headers={headers}
                filename={'user-report.csv'}
                className="btn btn-success"
              >
                ⬇ Download CSV
              </CSVLink>
            ) : (
              <button className="btn btn-primary" onClick={handleDownload}>
                ⬇ Download {downloadType.toUpperCase()}
              </button>
            )}
          </div>

          <div className="table-responsive">
            <table className="table table-bordered table-striped table-hover">
              <thead className="table-dark">
                <tr>
                  {headers.map((h, i) => (
                    <th key={i}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportData.map((row, idx) => (
                  <tr key={idx}>
                    {headers.map((h) => (
                      <td key={h.key}>
                        {typeof row[h.key] === 'boolean'
                          ? row[h.key] ? 'Yes' : 'No'
                          : row[h.key]?.toString() || 'N/A'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminUserReport;
