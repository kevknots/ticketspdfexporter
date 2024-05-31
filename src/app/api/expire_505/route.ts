import { db } from "@/lib/db";
import { NextRequest } from "next/server";
export const maxDuration = 300

export async function PUT(req: NextRequest) {
    try {
       
     const lte = new URL(req.url).searchParams.get('lte')
     const gte = new URL(req.url).searchParams.get('gte')
     const type = new URL(req.url).searchParams.get('type')


     const convertTZ = (date: string, tzString:string) => {
        return new Date((new Date(date)).toLocaleString("en-US", {timeZone: tzString}));   
    }

    const lteDate =  lte ? convertTZ(lte?.toString(),'America/New_York') : null

    const gteDate = gte ? convertTZ(gte?.toString(),'America/New_York') : null
        
        console.log(lteDate, gteDate)

        if(lteDate && gteDate){

        const ticketSearch = type === "winme" ? await db.tickets_winme.updateMany({
            where: {
                created_at: {
                    lte: lteDate,
                    gte: gteDate
                }
            },
            data:{
                status: 'inactive'
            }
        }) : await db.tickets.updateMany({
            where: {
                created_at: {
                    lte: lteDate,
                    gte: gteDate
                }
            },
            data:{
                status: 'inactive'
            }
        });

        console.log(ticketSearch)

        return new Response(JSON.stringify({
                updated: ticketSearch.count,
                    }),{status: 200});
    
    }

    } catch (error) {
        return new Response(JSON.stringify({
            error: error,
                }),{status: 500});    }
}
