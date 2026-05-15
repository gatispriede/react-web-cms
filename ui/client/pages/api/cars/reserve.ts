/**
 * Wave 7b — `/api/cars/reserve` POST endpoint. Anonymous reservation
 * for a car listing → creates an Inquiry row tagged with the car
 * externalId + `reservationType: 'soft-hold'`. Operator confirms the
 * deposit manually from the Cars admin pane.
 *
 * Validation parity with `/api/inquiry` (rate-limit, honeypot, length
 * caps); plus a phone requirement specific to car reservations.
 */
import type {NextApiRequest, NextApiResponse} from 'next';
import guid from '@utils/guid';
import {requireSameOrigin} from '../_origin';
import {clientIp, rateLimit} from '../_rateLimit';
import {getMongoConnection} from '@services/infra/mongoDBConnection';

const COLLECTION = 'Inquiries';
const PRODUCTS = 'Products';
const MAX_LEN = {name: 120, email: 200, phone: 60, message: 1500};

const isString = (v: unknown): v is string => typeof v === 'string';
const trim = (v: unknown): string => (isString(v) ? v.trim() : '');
const isPlausibleEmail = (s: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= MAX_LEN.email;
const isPlausiblePhone = (s: string): boolean =>
    /^[+0-9 ()-]{6,40}$/.test(s);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({error: 'Method not allowed'});
    }
    if (!requireSameOrigin(req, res)) return;

    const ip = clientIp(req);
    const rl = rateLimit(`cars-reserve:${ip}`, 5, 5 * 60_000);
    if (!rl.ok) {
        res.setHeader('Retry-After', Math.ceil(rl.retryAfterMs / 1000));
        return res.status(429).json({error: 'Too many submissions, please try again later.'});
    }

    let body: Record<string, unknown>;
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
        return res.status(400).json({error: 'Invalid JSON payload'});
    }
    if (!body || typeof body !== 'object') {
        return res.status(400).json({error: 'Invalid payload'});
    }
    if (trim(body.website).length > 0) return res.status(200).json({ok: true});

    const name = trim(body.name).slice(0, MAX_LEN.name);
    const email = trim(body.email).slice(0, MAX_LEN.email);
    const phone = trim(body.phone).slice(0, MAX_LEN.phone);
    const carExternalId = trim(body.carExternalId).slice(0, 200);
    const carSlug = trim(body.carSlug).slice(0, 200);
    const message = trim(body.message).slice(0, MAX_LEN.message);

    if (!email || !isPlausibleEmail(email)) {
        return res.status(400).json({error: 'A valid email is required'});
    }
    if (!phone || !isPlausiblePhone(phone)) {
        return res.status(400).json({error: 'A valid phone number is required'});
    }
    if (!carExternalId && !carSlug) {
        return res.status(400).json({error: 'Car identifier is required'});
    }

    const connection = getMongoConnection();
    for (let i = 0; i < 30 && !connection.database; i++) {
        await new Promise(r => setTimeout(r, 100));
    }
    const db = connection.database;
    if (!db) return res.status(503).json({error: 'Database not ready'});

    const car = carSlug
        ? await db.collection(PRODUCTS).findOne(
            {slug: carSlug, categories: 'cars'},
            {projection: {_id: 0, id: 1, slug: 1, externalId: 1, title: 1, price: 1, currency: 1, attributes: 1}},
        )
        : await db.collection(PRODUCTS).findOne(
            {externalId: carExternalId, categories: 'cars'},
            {projection: {_id: 0, id: 1, slug: 1, externalId: 1, title: 1, price: 1, currency: 1, attributes: 1}},
        );

    const id = guid();
    const now = new Date().toISOString();
    const doc = {
        id,
        createdAt: now,
        ip,
        userAgent: (req.headers['user-agent'] as string) ?? '',
        topic: 'car-reservation',
        name: name || '(anonymous)',
        email,
        phone,
        message: message || `Reservation request for ${car?.title ?? carExternalId ?? carSlug}`,
        recipient: 'cars@reservation.internal',
        car: {
            externalId: (car?.externalId as string | undefined) ?? carExternalId ?? null,
            slug: (car?.slug as string | undefined) ?? carSlug ?? null,
            title: (car?.title as string | undefined) ?? null,
            priceCents: (car?.price as number | undefined) ?? null,
            currency: (car?.currency as string | undefined) ?? 'EUR',
            vatRegime: typeof car?.attributes === 'object' && car?.attributes && typeof (car.attributes as Record<string, unknown>).vat_regime === 'string'
                ? (car.attributes as Record<string, unknown>).vat_regime as string
                : null,
        },
        reservationType: 'soft-hold' as const,
        reservationStatus: 'pending' as const,
    };

    try {
        await db.collection(COLLECTION).insertOne(doc);
    } catch (err) {
         
        console.error('[api/cars/reserve] insert failed:', err);
        return res.status(500).json({error: 'Could not save reservation'});
    }

    return res.status(200).json({ok: true, reservationId: id});
}
