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
    
    const generatePDF = () => {
        if (selectedType === '') {
            alert('Select tickets type first!');
            return;
        }
        
        setLoading(true);
        const fromAPI = formatDateForAPI(from);
        const toAPI = formatDateForAPI(to);
        
        const pdfUrl = `/api/generate?lte=${encodeURIComponent(toAPI)}&gte=${encodeURIComponent(fromAPI)}&type=${selectedType}`;
        window.open(pdfUrl, '_blank');
        
        setTimeout(() => setLoading(false), 5000);
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Ticket PDF Generator - 11x17 Format</h1>
            
            <div className="bg-gray-50 p-6 rounded-lg mb-6">
                <h2 className="text-lg font-semibold mb-4">Select Date Range (EST)</h2>
                <DateSelector 
                    to={to} 
                    from={from} 
                    setTo={setTo} 
                    setFrom={setFrom} 
                />
            </div>

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

            <div className="flex gap-4 flex-wrap mb-6">
                {loading ? (
                    <div className="flex items-center gap-2">
                        <CircularProgress isIndeterminate color='green.300' size="sm" />
                        <span>Processing...</span>
                    </div>
                ) : (
                    <button 
                        className="px-6 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors shadow-lg disabled:opacity-50"
                        onClick={generatePDF}
                        disabled={!selectedType}
                    >
                        Generate PDF
                    </button>
                )}
            </div>
        </div>
    );
}
