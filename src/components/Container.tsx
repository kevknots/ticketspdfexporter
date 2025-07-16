'use client'
import { CircularProgress } from "@chakra-ui/react";
import { useState } from "react";
import { DateSelector } from "./DateSelector"

// 🔧 FIXED: Simple date formatting - let the browser handle timezone conversion
const formatDateForAPI = (date: Date): string => {
    return date.toISOString();
};

// Type definition for debug data
type DebugData = {
    ticketType: string;
    summary: {
        phoneStats: {
            total: number;
            hasAnyPhone: number;
            noPhone: number;
        };
        july2025Count: number;
        monthCounts: Record<string, number>;
    };
    phoneIssues: Array<{
        ticket_number: string;
        name: string;
        contact_id: string;
    }>;
};

export function Container(){
    // 🔧 FIXED: Initialize with July 2025 date range by default
    const now = new Date();
    const [to, setTo] = useState(now);
    // Default to July 1st, 2025 for "from" date
    const july1st = new Date(2025, 6, 1); // Month is 0-indexed, so 6 = July
    const [from, setFrom] = useState(july1st);
    const [loading, setLoading] = useState(false);
    const [selectedType, setSelectedType] = useState('');
    const [debugData, setDebugData] = useState<DebugData | null>(null);
    
    console.log('Selected dates:', {
        from: from.toLocaleString("en-US", {timeZone: "America/New_York"}),
        to: to.toLocaleString("en-US", {timeZone: "America/New_York"}),
        fromISO: formatDateForAPI(from),
        toISO: formatDateForAPI(to)
    });
    
    const expireTickets = async (type: string) => {
        try {
            // Validate dates
            if (isNaN(from.getTime()) || isNaN(to.getTime())) {
                alert('Invalid date selected!');
                return;
            }
            
            if (from >= to) {
                alert('From date must be before To date!');
                return;
            }
            
            setLoading(true);
            const fromAPI = formatDateForAPI(from);
            const toAPI = formatDateForAPI(to);
            
            const res = await fetch(`/api/expire_505?lte=${encodeURIComponent(toAPI)}&gte=${encodeURIComponent(fromAPI)}&type=${type}`, {
                method: 'PUT'
            });
            
            const body = await res.json();
            if (body.updated) {
                alert(`Expired ${body.updated} tickets successfully!`);
            } else {
                alert('No tickets found to expire in the selected date range.');
            }
        } catch (err) {
            console.error('Error expiring tickets:', err);
            alert('Error expiring tickets. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const testDateRange = async () => {
        if (!selectedType) {
            alert('Select a ticket type first!');
            return;
        }
        
        try {
            setLoading(true);
            const fromAPI = formatDateForAPI(from);
            const toAPI = formatDateForAPI(to);
            
            const res = await fetch(`/api/test-dates?lte=${encodeURIComponent(toAPI)}&gte=${encodeURIComponent(fromAPI)}&type=${selectedType}`);
            const data = await res.json();
            
            if (data.success) {
                console.log('Date test results:', data);
                alert(`✅ Date test successful!\n\nFound ${data.query_results.total_tickets_found} tickets in range\nSample tickets: ${data.query_results.sample_count}\n\nCheck console for detailed results.`);
            } else {
                console.error('Date test failed:', data);
                alert(`❌ Date test failed: ${data.error}`);
            }
        } catch (err) {
            console.error('Error testing dates:', err);
            alert('Error testing dates. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const debugTicketData = async () => {
        if (!selectedType) {
            alert("Select a ticket type first!");
            return;
        }
        
        try {
            setLoading(true);
            const res = await fetch(`/api/debug-data?type=${selectedType}`);
            const data = await res.json();
            setDebugData(data);
            console.log('Debug data:', data);
        } catch (err) {
            console.error('Error fetching debug data:', err);
            alert('Error fetching debug data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const generatePDF = () => {
        if (selectedType === '') {
            alert('Select tickets type first!');
            return;
        }
        
        // Validate dates
        if (isNaN(from.getTime()) || isNaN(to.getTime())) {
            alert('Invalid date selected!');
            return;
        }
        
        if (from >= to) {
            alert('From date must be before To date!');
            return;
        }
        
        setLoading(true);
        const fromAPI = formatDateForAPI(from);
        const toAPI = formatDateForAPI(to);
        
        // Open PDF in new window
        const pdfUrl = `/api/generate?lte=${encodeURIComponent(toAPI)}&gte=${encodeURIComponent(fromAPI)}&type=${selectedType}`;
        console.log('Opening PDF URL:', pdfUrl);
        console.log('Date params:', { fromAPI, toAPI });
        window.open(pdfUrl, '_blank');
        
        // Reset loading after a short delay
        setTimeout(() => setLoading(false), 2000);
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Ticket PDF Generator - 11x17 Format</h1>
            
            {/* Date Selection */}
            <div className="bg-gray-50 p-6 rounded-lg mb-6">
                <h2 className="text-lg font-semibold mb-4">Select Date Range (EST)</h2>
                <DateSelector 
                    to={to} 
                    from={from} 
                    setTo={setTo} 
                    setFrom={setFrom} 
                />
                
                {/* Display selected range in EST */}
                <div className="mt-4 p-3 bg-blue-50 rounded text-sm">
                    <strong>Selected Range (EST):</strong><br/>
                    From: {from.toLocaleString("en-US", {timeZone: "America/New_York"})}<br/>
                    To: {to.toLocaleString("en-US", {timeZone: "America/New_York"})}
                </div>
            </div>

            {/* Ticket Type Selection */}
            <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Ticket Type:</label>
                <select 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                >
                    <option value="">Select Tickets Type</option>
                    <option value="badd">BADD Tickets</option>
                    <option value="winme">WinMe Tickets</option>
                </select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 flex-wrap mb-6">
                {loading ? (
                    <div className="flex items-center gap-2">
                        <CircularProgress isIndeterminate color='green.300' size="sm" />
                        <span>Processing...</span>
                    </div>
                ) : (
                    <>
                        <button 
                            className="px-6 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors shadow-lg disabled:opacity-50"
                            onClick={generatePDF}
                            disabled={!selectedType}
                        >
                            📄 Generate 11x17 PDF (40 per page)
                        </button>
                        
                        <button 
                            className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors shadow-lg disabled:opacity-50"
                            onClick={testDateRange}
                            disabled={!selectedType}
                        >
                            🧪 Test Date Range
                        </button>
                        
                        <button 
                            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-lg disabled:opacity-50"
                            onClick={debugTicketData}
                            disabled={!selectedType}
                        >
                            🔍 Debug Ticket Data
                        </button>
                        
                        <button 
                            className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg disabled:opacity-50"
                            onClick={() => expireTickets(selectedType)}
                            disabled={!selectedType}
                        >
                            ⚠️ Expire Tickets in Date Range
                        </button>
                    </>
                )}
            </div>

            {/* Debug Data Display */}
            {debugData && (
                <div className="bg-gray-50 p-6 rounded-lg mb-6">
                    <h3 className="text-lg font-semibold mb-4">Debug Results for {debugData.ticketType} Tickets</h3>
                    
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="bg-white p-3 rounded">
                            <div className="text-2xl font-bold text-blue-600">{debugData.summary?.phoneStats?.total || 0}</div>
                            <div className="text-sm text-gray-600">Total Analyzed</div>
                        </div>
                        <div className="bg-white p-3 rounded">
                            <div className="text-2xl font-bold text-green-600">{debugData.summary?.phoneStats?.hasAnyPhone || 0}</div>
                            <div className="text-sm text-gray-600">Have Phone Numbers</div>
                        </div>
                        <div className="bg-white p-3 rounded">
                            <div className="text-2xl font-bold text-red-600">{debugData.summary?.phoneStats?.noPhone || 0}</div>
                            <div className="text-sm text-gray-600">Missing Phone Numbers</div>
                        </div>
                        <div className="bg-white p-3 rounded">
                            <div className="text-2xl font-bold text-purple-600">{debugData.summary?.july2025Count || 0}</div>
                            <div className="text-sm text-gray-600">July 2025 Tickets</div>
                        </div>
                    </div>

                    {/* Month Distribution */}
                    <div className="mb-4">
                        <h4 className="font-semibold mb-2">Tickets by Month:</h4>
                        <div className="bg-white p-3 rounded">
                            {debugData.summary?.monthCounts && Object.entries(debugData.summary.monthCounts).map(([month, count]) => (
                                <span key={month} className={`inline-block px-2 py-1 rounded text-sm mr-2 mb-1 ${
                                    month.includes('2025-07') ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                    {month}: {count}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Phone Issues */}
                    {debugData.phoneIssues && debugData.phoneIssues.length > 0 && (
                        <div className="mb-4">
                            <h4 className="font-semibold mb-2 text-red-600">Tickets Missing Phone Numbers:</h4>
                            <div className="bg-white p-3 rounded max-h-40 overflow-y-auto">
                                {debugData.phoneIssues.map((ticket, idx) => (
                                    <div key={idx} className="text-sm mb-1">
                                        <strong>{ticket.ticket_number}</strong> - {ticket.name || 'No name'} 
                                        {ticket.contact_id && <span className="text-gray-500"> (contact_id: {ticket.contact_id})</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button 
                        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                        onClick={() => setDebugData(null)}
                    >
                        Close Debug Data
                    </button>
                </div>
            )}

            {/* Instructions */}
            <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="font-semibold text-yellow-800 mb-2">Latest Updates & Instructions:</h3>
                <ul className="text-sm text-yellow-700 space-y-1">
                    <li>✅ <strong>Format:</strong> Changed to 11x17 paper, 5 across x 8 down (40 tickets per page)</li>
                    <li>✅ <strong>Phone Numbers:</strong> Improved detection from contact_id field</li>
                    <li>✅ <strong>Date Filtering:</strong> Fixed timezone handling for accurate month filtering</li>
                    <li>🧪 <strong>Test Date Range:</strong> Use this button FIRST to verify your date range finds the right tickets</li>
                    <li>🔧 <strong>Debug Tool:</strong> Use &quot;Debug Ticket Data&quot; to analyze your data quality</li>
                    <li>📅 Default date range set to July 2025</li>
                    <li>⚠️ <strong>Recommended workflow:</strong> Test Date Range → Debug Data → Generate PDF</li>
                </ul>
            </div>
        </div>
    );
}
