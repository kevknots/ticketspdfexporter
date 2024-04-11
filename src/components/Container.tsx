'use client'

import { CircularProgress } from "@chakra-ui/react";
import { useState } from "react";
import { DateSelector } from "./DateSelector"


export function Container(){
 
    const [to, setTo] = useState(new Date());
    const [from, setFrom] = useState(new Date());
    const [loading, setLoading] = useState(false);
    
    console.log(to.toISOString(),from.toISOString())

    return (<>
          <div className="px-20 py-20"><DateSelector to={to} from={from} setTo={setTo} setFrom={setFrom} /></div>
          
         { loading ? <CircularProgress isIndeterminate color='green.300' />
         : <button className="px-8 py-8 rounded-lg hover:shadow-lg" onClick={()=>{
            setLoading(true)
            window.location.replace(`/api/generate?lte=${to.toISOString()}&gte=${from.toISOString()}`)
            }}>Confirm</button>
            }
    </>)
}