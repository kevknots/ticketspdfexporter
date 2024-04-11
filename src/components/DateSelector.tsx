'use client'
import React, { Dispatch, SetStateAction } from "react";
import DatePicker from "react-datepicker";

import "react-datepicker/dist/react-datepicker.css";

// CSS Modules, react-datepicker-cssmodules.css
// import 'react-datepicker/dist/react-datepicker-cssmodules.css';

type DateSelectorProps = {
    to: Date
    setTo: Dispatch<SetStateAction<Date>>
    from: Date
    setFrom: Dispatch<SetStateAction<Date>>
}

export function DateSelector({to, from, setTo, setFrom}: DateSelectorProps){

  return (
    <>
    <div className="px-5 py-5">
    {//@ts-ignore
   <><p>From :</p><DatePicker selected={from} onChange={(date) => setFrom(date)} showTimeSelect/></>
  }</div>
  <div className="px-5 py-5">
    {//@ts-ignore
    <><p>To : </p><DatePicker selected={to} onChange={(date) => setTo(date)} showTimeSelect/></>
    }
    </div>
    </>
    );
};