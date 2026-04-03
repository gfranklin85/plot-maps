import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY!;

interface LatLng {
  lat: number;
  lng: number;
  label?: string;
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();

    // Simple mode: { from, to }
    if (body.from && body.to) {
      const from = body.from as LatLng;
      const to = body.to as LatLng;

      const origins = `${from.lat},${from.lng}`;
      const destinations = `${to.lat},${to.lng}`;

      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&key=${GOOGLE_API_KEY}&units=imperial`;
      const res = await fetch(url);
      const data = await res.json();

      if (
        data.status === 'OK' &&
        data.rows?.[0]?.elements?.[0]?.status === 'OK'
      ) {
        const el = data.rows[0].elements[0];
        return NextResponse.json({
          distance: el.distance.text,
          duration: el.duration.text,
          status: 'OK',
        });
      }

      return NextResponse.json({
        distance: null,
        duration: null,
        status: data.rows?.[0]?.elements?.[0]?.status || 'FAILED',
      });
    }

    // Full mode: { origins, destinations }
    const origins = body.origins as LatLng[];
    const destinations = body.destinations as LatLng[];

    if (!origins?.length || !destinations?.length) {
      return NextResponse.json(
        { error: 'origins and destinations are required' },
        { status: 400 }
      );
    }

    const originsStr = origins.map((o) => `${o.lat},${o.lng}`).join('|');
    const destsStr = destinations.map((d) => `${d.lat},${d.lng}`).join('|');

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originsStr}&destinations=${destsStr}&key=${GOOGLE_API_KEY}&units=imperial`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK') {
      return NextResponse.json(
        { error: data.error_message || 'Distance Matrix request failed' },
        { status: 502 }
      );
    }

    const rows = data.rows.map(
      (row: {
        elements: {
          status: string;
          distance?: { text: string; value: number };
          duration?: { text: string; value: number };
        }[];
      }) => ({
        elements: row.elements.map(
          (el: {
            status: string;
            distance?: { text: string; value: number };
            duration?: { text: string; value: number };
          }) => ({
            distance: el.distance?.text ?? null,
            distanceValue: el.distance?.value ?? null,
            duration: el.duration?.text ?? null,
            durationValue: el.duration?.value ?? null,
            status: el.status,
          })
        ),
      })
    );

    return NextResponse.json({ rows });
  } catch (error: unknown) {
    console.error('Distance matrix error:', error);
    const message =
      error instanceof Error ? error.message : 'Distance matrix failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
