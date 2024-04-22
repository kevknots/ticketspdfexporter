'use client'

import { CircularProgress } from "@chakra-ui/react";
import { useState } from "react";
import { DateSelector } from "./DateSelector"


export function Container(){
 
    const [to, setTo] = useState(new Date());
    const [from, setFrom] = useState(new Date());
    const [loading, setLoading] = useState(false);
    
    console.log(to.toISOString(),from.toISOString())

    const expireTickets = async ()=>{
        try{
        const res = await fetch(`/api/expire_505?lte=${to.toISOString()}&gte=${from.toISOString()}`,{
            method: 'PUT'
        })
        const body = await res.json()

        if(body.updated){
            setLoading(false)
            alert(`expired ${body.updated} tickets successfully!`)

        }
    } catch(err){
        console.log(err)
    }
    
    }

    return (<>
          <div className="px-20 py-20"><DateSelector to={to} from={from} setTo={setTo} setFrom={setFrom} /></div>
          
         { loading ? <CircularProgress isIndeterminate color='green.300' />
         : <button className="px-8 py-8 bg-teal-200 rounded-lg hover:shadow-lg" onClick={()=>{
            setLoading(true)
            window.location.replace(`/api/generate?lte=${to.toISOString()}&gte=${from.toISOString()}`)
            }}>Get PDF for date range</button>
            }
        { loading ? <></>
         : <button className="px-8 py-8 bg-red-200 rounded-lg hover:shadow-lg" onClick={async()=>{
            setLoading(true)
            await expireTickets()
            }}>Expire tickets within date range</button>
            }
    </>)
}