'use client'
import { CircularProgress } from "@chakra-ui/react";
import { useState } from "react";
import { DateSelector } from "./DateSelector"

// 🔧 Helper function to convert date to EST and format for API
const formatDateForEST = (date: Date): string => {
    // Create a new date in EST timezone
    const estDate = new Date(date.toLocaleString("en-US", {timeZone: "America/New_York"}));
    return estDate.toISOString();
};

export function Container(){
    // 🔧 FIXED: Initialize with current EST time
    const now = new Date();
    const [to, setTo] = useState(now);
    const [from, setFrom] = useState(new Date(now.getTime() - 24 * 60 * 60 * 1000)); // 24 hours ago
    const [loading, setLoading] = useState(false);
    const [selectedType, setSelectedType] = useState('');
    
    // 🔧 IMPROVED: Better date formatting for debugging
    console.log('Selected dates:', {
        from: from.toLocaleString("en-US", {timeZone: "America/New_York"}),
        to: to.toLocaleString("en-US", {timeZone: "America/New_York"}),
        fromISO: formatDateForEST(from),
        toISO: formatDateForEST(to)
    });
    
    const expireTickets = async (type: string) => {
        try {
            setLoading(true);
            const fromEST = formatDateForEST(from);
            const toEST = formatDateForEST(to);
            
            const res = await fetch(`/api/expire_505?lte=${toEST}&gte=${fromEST}&type=${type}`, {
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
            alert("Select tickets type first!");
            return;
        }
        
        setLoading(true);
        const fromEST = formatDateForEST(from);
        const toEST = formatDateForEST(to);
        
        // Open PDF in new window
        const pdfUrl = `/api/generate?lte=${toEST}&gte=${fromEST}&type=${selectedType}`;
        window.open(pdfUrl, '_blank');
        
        // Reset loading after a short delay
        setTimeout(() => setLoading(false), 2000);
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Ticket PDF Generator</h1>
            
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
            <div className="flex gap-4 flex-wrap">
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
                            📄 Generate PDF for Date Range
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

            {/* Instructions */}
            <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="font-semibold text-yellow-800 mb-2">Instructions:</h3>
                <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• All times are automatically converted to EST</li>
                    <li>• PDF generation opens in a new tab</li>
                    <li>• Expire function permanently marks tickets as inactive</li>
                    <li>• Select a reasonable date range to avoid timeouts</li>
                </ul>
            </div>
        </div>
    );
}
