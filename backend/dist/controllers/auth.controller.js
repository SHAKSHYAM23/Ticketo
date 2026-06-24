import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';
export const register = async (req, res) => {
    try {
        const { email, password, name } = req.body;
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing)
            return res.status(400).json({ error: 'Email already registered' });
        const hashed = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { email, password: hashed, name }
        });
        res.status(201).json({ message: 'Registered successfully', userId: user.id });
    }
    catch (err) {
        res.status(500).json({ error: 'Something went wrong' });
    }
};
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user)
            return res.status(400).json({ error: 'Invalid credentials' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid)
            return res.status(400).json({ error: 'Invalid Password' });
        const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, userId: user.id, name: user.name });
    }
    catch (err) {
        res.status(500).json({ error: 'Something went wrong' });
    }
};
export const adminLogin = async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        res.status(400).json({ error: 'Invalid credentials' });
        return;
    }
    // extra check — reject non-admins immediately
    if (user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access only' });
        return;
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
        res.status(400).json({ error: 'Invalid credentials' });
        return;
    }
    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, userId: user.id, role: user.role });
};
