'use client'
import { CircularProgress } from "@chakra-ui/react";
import { useState } from "react";
import { DateSelector } from "./DateSelector"

const formatDateForAPI = (date: Date): string => {
    return date.toISOString();
};

export function Container(){
    const now = new Date();
    const [to, setTo] = useState(now);
    const july1st = new Date(2025, 6, 1);
    const [from, setFrom] = useState(july1st);
    const [loading, setLoading] = useState(false);
    const [selectedType, setSelectedType] = useState('');
    const [testMode, setTestMode] = useState(false);
    
    console.log('Selected dates:', {
        from: from.toLocaleString("en-US", {timeZone: "America/New_York"}),
        to: to.toLocaleString("en-US", {timeZone: "America/New_York"}),
        fromISO: formatDateForAPI(from),
        toISO: formatDateForAPI(to)
    });
    
    const expireTickets = async (type: string) => {
        try {
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

    const generatePDF = () => {
        if (selectedType === '') {
            alert('Select tickets type first!');
            return;
        }
        
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
        
        const limitParam = testMode ? '&limit=100' : '';
        
        const pdfUrl = `/api/generate?lte=${encodeURIComponent(toAPI)}&gte=${encodeURIComponent(fromAPI)}&type=${selectedType}${limitParam}`;
        console.log('🚀 Opening PDF URL:', pdfUrl);
        console.log('📊 Performance mode:', testMode ? 'Test (100 tickets max)' : 'Full');
        
        if (!testMode) {
            alert('📄 Generating 11x17 PORTRAIT PDF... This should be much faster now! Check console for progress.');
        }
        
        window.open(pdfUrl, '_blank');
        
        setTimeout(() => setLoading(false), testMode ? 3000 : 8000);
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Ticket PDF Generator - 11x17 PORTRAIT Format</h1>
            
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

            {/* Test Mode Option */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <label className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        checked={testMode}
                        onChange={(e) => setTestMode(e.target.checked)}
                        className="rounded"
                    />
                    <span className="text-sm font-medium">
                        🚀 Test Mode (Generate only first 100 tickets for quick testing)
                    </span>
                </label>
                <p className="text-xs text-blue-600 mt-1">
                    Enable this for quick testing. Disable for full production PDFs.
                </p>
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
                            className={`px-6 py-3 text-white rounded-lg transition-colors shadow-lg disabled:opacity-50 ${
                                testMode 
                                    ? 'bg-orange-500 hover:bg-orange-600' 
                                    : 'bg-teal-500 hover:bg-teal-600'
                            }`}
                            onClick={generatePDF}
                            disabled={!selectedType}
                        >
                            {testMode 
                                ? '🚀 Generate Test PDF (100 tickets)' 
                                : '📄 Generate 11x17 PORTRAIT PDF (40 per page)'
                            }
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

            {/* Format Info */}
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-2">📄 PDF Format Information:</h3>
                <div className="text-sm text-green-700 space-y-1">
                    <div><strong>Paper Size:</strong> 11" × 17" (Portrait orientation)</div>
                    <div><strong>Layout:</strong> 5 tickets across × 8 tickets down = 40 tickets per page</div>
                    <div><strong>Ticket Size:</strong> Approximately 50mm × 50mm each</div>
                    <div><strong>Orientation:</strong> PORTRAIT (11" wide, 17" tall)</div>
                </div>
            </div>

            {/* Instructions */}
            <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="font-semibold text-yellow-800 mb-2">Instructions:</h3>
                <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• All times are automatically converted to EST</li>
                    <li>• PDF generation opens in a new tab</li>
                    <li>• Expire function permanently marks tickets as inactive</li>
                    <li>• Select a reasonable date range to avoid timeouts</li>
                    <li>• <strong>NEW:</strong> 11x17 PORTRAIT format (not landscape)</li>
                    <li>• Phone numbers extracted from both phone_number and contact_id fields</li>
                    <li>• Use Test Mode for quick validation before generating full PDFs</li>
                    <li>• Check browser console for phone number debugging info</li>
                </ul>
            </div>
        </div>
    );
}
