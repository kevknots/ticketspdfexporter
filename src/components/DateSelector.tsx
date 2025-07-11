'use client'
import React, { Dispatch, SetStateAction } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

type DateSelectorProps = {
    to: Date
    setTo: Dispatch<SetStateAction<Date>>
    from: Date
    setFrom: Dispatch<SetStateAction<Date>>
}

export function DateSelector({to, from, setTo, setFrom}: DateSelectorProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* From Date */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                    From Date & Time (EST):
                </label>
                <DatePicker 
                    selected={from} 
                    onChange={(date: Date | null) => date && setFrom(date)}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={15}
                    timeCaption="Time"
                    dateFormat="MMMM d, yyyy h:mm aa"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholderText="Select start date and time"
                    maxDate={new Date()} // Can't select future dates
                    // 🔧 Configure for EST timezone
                    timeZone="America/New_York"
                />
                <p className="text-xs text-gray-500">
                    Selected: {from.toLocaleString("en-US", {timeZone: "America/New_York"})} EST
                </p>
            </div>

            {/* To Date */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                    To Date & Time (EST):
                </label>
                <DatePicker 
                    selected={to} 
                    onChange={(date: Date | null) => date && setTo(date)}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={15}
                    timeCaption="Time"
                    dateFormat="MMMM d, yyyy h:mm aa"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholderText="Select end date and time"
                    minDate={from} // End date can't be before start date
                    maxDate={new Date()} // Can't select future dates
                    // 🔧 Configure for EST timezone
                    timeZone="America/New_York"
                />
                <p className="text-xs text-gray-500">
                    Selected: {to.toLocaleString("en-US", {timeZone: "America/New_York"})} EST
                </p>
            </div>

            {/* Quick Date Range Buttons */}
            <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quick Select:
                </label>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => {
                            const now = new Date();
                            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                            setFrom(yesterday);
                            setTo(now);
                        }}
                        className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border"
                    >
                        Last 24 Hours
                    </button>
                    <button
                        onClick={() => {
                            const now = new Date();
                            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                            setFrom(weekAgo);
                            setTo(now);
                        }}
                        className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border"
                    >
                        Last 7 Days
                    </button>
                    <button
                        onClick={() => {
                            const now = new Date();
                            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                            setFrom(monthAgo);
                            setTo(now);
                        }}
                        className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border"
                    >
                        Last 30 Days
                    </button>
                    <button
                        onClick={() => {
                            const now = new Date();
                            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                            setFrom(startOfToday);
                            setTo(now);
                        }}
                        className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border"
                    >
                        Today
                    </button>
                </div>
            </div>
        </div>
    );
}
