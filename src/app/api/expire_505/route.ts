import { db } from "@/lib/db";
import { NextRequest } from "next/server";
export const maxDuration = 300

export async function PUT(req: NextRequest) {
    try {
       
     const lte = new URL(req.url).searchParams.get('lte')
     const gte = new URL(req.url).searchParams.get('gte')
     const type = new URL(req.url).searchParams.get('type')


         // Convert EST time to UTC time
    const convertToUTC = (date, tzString) => {
    const localDate = new Date(date);
    const utcDate = new Date(localDate.toLocaleString('en-US', { timeZone: tzString }));
    return new Date(utcDate.toISOString());
    }

    const lteDate = lte ? convertToUTC(lte.toString(), 'America/New_York') : null;
    const gteDate = gte ? convertToUTC(gte.toString(), 'America/New_York') : null;

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
