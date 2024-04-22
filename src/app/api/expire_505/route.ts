import { db } from "@/lib/db";
import { NextRequest } from "next/server";
export const maxDuration = 300

export async function PUT(req: NextRequest) {
    try {
       
     const lte = new URL(req.url).searchParams.get('lte')
     const gte = new URL(req.url).searchParams.get('gte')


    const lteDate =  lte ? new Date(lte?.toString()) : null

    const gteDate = gte ? new Date(gte?.toString()) : null
        
        console.log(lteDate, gteDate)

        if(lteDate && gteDate){

        const ticketSearch = await db.tickets.updateMany({
            where: {
                created_at: {
                    lte: lteDate,
                    gte: gteDate
                }
            },
            data:{
                status: 'active'
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
