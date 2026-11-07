#!/usr/bin/env python3
"""
Y性代数·不止Y数 (Y-Linear Algebra Society) Official Portal & Membership System
Full-featured HTTP server with SQLite persistence, Token-based Auth, and Admin Management.
Fully synchronized with Canva Design Suite (DAHY7U3hoeM & DAHaO8nKCWs).
"""

import os
import sys
import json
import sqlite3
import hashlib
import secrets
import mimetypes
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime

PORT = int(os.environ.get("PORT", 8088))
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.db")
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

# In-memory session store: token -> user_dict
SESSIONS = {}

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member', -- 'admin' or 'member'
        academic_interest TEXT DEFAULT '线性代数与学术研讨',
        affiliation TEXT DEFAULT '学术研讨社团成员',
        bio TEXT DEFAULT '致力于学术研讨交流，推动集体共同进步。',
        status TEXT DEFAULT 'active', -- 'active', 'pending', 'inactive'
        created_at TEXT NOT NULL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS seminars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        speaker TEXT NOT NULL,
        date TEXT NOT NULL,
        location TEXT NOT NULL,
        description TEXT NOT NULL,
        tags TEXT NOT NULL
    )
    """)

    # Check if admin exists
    cursor.execute("SELECT id FROM users WHERE email = 'admin@yxingdaishu.org'")
    admin = cursor.fetchone()
    if not admin:
        salt = secrets.token_hex(8)
        pwd_hash = hash_password("lh660680", salt)
        cursor.execute("""
        INSERT INTO users (email, password_hash, name, role, academic_interest, affiliation, bio, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "admin@yxingdaishu.org",
            f"{salt}:{pwd_hash}",
            "社团信息库主管 (Admin)",
            "admin",
            "代数几何与群体协同研讨",
            "社团学术委员会 · 月月办公室",
            "负责社团学术资源统筹与成员信息库管理，推动集体学术共进！",
            "active",
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ))

        # Synchronize authentic faculty and student records from Canva
        authentic_members = [
            ("wang.prof@yanshu.edu", "王教授 (兵王·创始人)", "admin", "艳数理论与哲学代数", "艳数师范大学哲学系 / 艳系数学类学院", "2026年首次创造性提出‘艳数’概念，联合李教授创立‘Y性代数’，荣获创新发明奖与最受学生爱戴奖。"),
            ("li.prof@yanshu.edu", "李教授 (联合创始人)", "admin", "月系高阶代数", "月系数学类学院", "Y性代数联合创始人，长期致力于前沿学术研讨体系建设与共同进步理念落地。"),
            ("qiuqiu@yanshu.edu", "rqnj (球球·重要负责人)", "admin", "矩阵动力学与代数拓扑", "艳系数学类学院", "首批核心元老，积极推动Y数事业蓬勃发展。"),
            ("rolex.prof@yanshu.edu", "劳力士教授 (Dc. Rolex)", "member", "数理经济与矩阵博弈", "艳数师范大学经济系", "现任主讲教授，荣获最受学生爱戴奖。"),
            ("aminoacid.prof@yanshu.edu", "氨基酸教授 (Dc. AminoAcid)", "member", "分子代数与化学生物建模", "艳数大学化学系 / 静系化学学院", "现任主讲教授，贯通化学与生命科学的跨学科建模研讨。"),
            ("sun.prof@yanshu.edu", "孙教授 (Dc. Zhehan Sun)", "member", "人体生理建模与连续动力学", "艳数师范大学人体生理学系", "获誉‘Air Cup’，特招加入艳数集团讲师团，现任主讲教授。"),
            ("jia.xiang@yanshu.edu", "贾响同学 (二号同学)", "member", "高维贯通算法", "艳数3+2贯通实验班", "学习态度端正，勤奋认真，获誉‘二号同学’。"),
            ("norman@yanshu.edu", "诺尔曼同学", "member", "张量网络与算法复现", "艳数3+2贯通实验班", "求知欲旺盛，严谨求实，实验班优秀学生代表。"),
            ("liuruyan@yanshu.edu", "柳如烟同学 (new.lry)", "member", "文学与学术跨界研讨", "特招学术后备军", "2026年特招选拔加入Y性代数，严谨求实，跨学科新生力量。"),
            ("hejingwen@yanshu.edu", "贺靖雯同学 (new.hjw)", "member", "历史背景与文献编纂", "特招学术后备军", "2026年特招选拔加入Y性代数，主笔社团文学作品《艳月后宫传》。")
        ]
        for email, name, role, interest, aff, bio in authentic_members:
            salt = secrets.token_hex(8)
            p_hash = hash_password("Member123456", salt)
            cursor.execute("""
            INSERT INTO users (email, password_hash, name, role, academic_interest, affiliation, bio, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (email, f"{salt}:{p_hash}", name, role, interest, aff, bio, "active", datetime.now().strftime("%Y-%m-%d %H:%M:%S")))

    # Initial seminars based on Canva schedule and lore
    cursor.execute("SELECT COUNT(*) as cnt FROM seminars")
    if cursor.fetchone()["cnt"] == 0:
        seminars = [
            ("【第42期研讨】从单应矩阵到高维神经流形：代数视角下的空间变换", "陈研 博士", "2026-11-15 19:00", "月月办公室 / 线上同步", "探讨线性代数与拓扑学在现代三维几何与大模型隐空间中的前沿交叉应用，欢迎各位成员携论文提纲参与交流。", "线性代数,流形学习,三维视觉"),
            ("【第43期沙龙】奇异值分解(SVD)与主成分降维：从理论推导到大模型LoRA压缩实战", "林张量 算法专家", "2026-11-28 14:30", "艳系数学学院研讨厅", "全面解剖低秩矩阵近似在当代前沿大模型轻量化微调(LoRA)中的本质数学结构，现场配备代码演练环境。", "SVD,LoRA,矩阵分解"),
            ("【学术思辨】‘不止Y数’核心论题研读：把证明写在同一张纸上", "王教授 & 李教授", "2026-12-05 19:30", "月月办公室 🌛 / 腾讯会议", "自由讨论：把问题摊开，把证明写完，把没想通的部分交还给集体。社员轮流分享近期学术灵感与卡点。", "开放研讨,跨学科,群体进步")
        ]
        for title, speaker, date, loc, desc, tags in seminars:
            cursor.execute("INSERT INTO seminars (title, speaker, date, location, description, tags) VALUES (?, ?, ?, ?, ?, ?)",
                           (title, speaker, date, loc, desc, tags))

    conn.commit()
    conn.close()

def hash_password(password: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}{password}".encode("utf-8")).hexdigest()

def verify_password(stored: str, password: str) -> bool:
    try:
        salt, expected_hash = stored.split(":", 1)
        return hash_password(password, salt) == expected_hash
    except Exception:
        return False

class AppRequestHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS and basic security headers
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_HEAD(self):
        self.do_GET()

    def send_json(self, status_code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def parse_json_body(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length == 0:
                return {}
            data = self.rfile.read(content_length).decode("utf-8")
            return json.loads(data)
        except Exception:
            return None

    def get_current_user(self):
        auth_header = self.headers.get("Authorization", "")
        token = ""
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
        if not token:
            cookie = self.headers.get("Cookie", "")
            for part in cookie.split(";"):
                if part.strip().startswith("session="):
                    token = part.strip().split("=", 1)[1]
                    break
        return SESSIONS.get(token)

    def do_GET(self):
        url = urlparse(self.path)
        path = url.path

        if path == "/api/me":
            user = self.get_current_user()
            if not user:
                return self.send_json(401, {"error": "未登录或登录已过期"})
            return self.send_json(200, {"user": user})

        elif path == "/api/stats":
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as total_users FROM users")
            total_users = cursor.fetchone()["total_users"]
            cursor.execute("SELECT COUNT(*) as active_members FROM users WHERE status = 'active'")
            active_members = cursor.fetchone()["active_members"]
            cursor.execute("SELECT COUNT(*) as total_seminars FROM seminars")
            total_seminars = cursor.fetchone()["total_seminars"]
            conn.close()
            return self.send_json(200, {
                "total_users": total_users,
                "active_members": active_members,
                "total_seminars": total_seminars,
                "club_name": "Y性代数·不止Y数",
                "version": "Beta 0.2.3",
                "canva_design_id": "DAHY7U3hoeM",
                "canva_view_url": "https://www.canva.com/d/SoTA5LTm6nnC3Fp",
                "canva_poster_url": "https://canva.link/kvxpxis7fljrlnw"
            })

        elif path == "/api/seminars":
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM seminars ORDER BY id ASC")
            seminars = [dict(row) for row in cursor.fetchall()]
            conn.close()
            return self.send_json(200, {"seminars": seminars})

        elif path == "/api/admin/members":
            user = self.get_current_user()
            if not user or user.get("role") != "admin":
                return self.send_json(403, {"error": "权限不足：需要信息库管理员权限"})
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT id, email, name, role, academic_interest, affiliation, bio, status, created_at FROM users ORDER BY id DESC")
            members = [dict(row) for row in cursor.fetchall()]
            conn.close()
            return self.send_json(200, {"members": members})

        # Static file serving
        clean_path = path.lstrip("/")
        if not clean_path:
            clean_path = "index.html"
        
        file_path = os.path.join(STATIC_DIR, clean_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            content_type, _ = mimetypes.guess_type(file_path)
            if not content_type:
                content_type = "application/octet-stream"
            with open(file_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", f"{content_type}; charset=utf-8" if "text" in content_type or "javascript" in content_type else content_type)
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        else:
            index_file = os.path.join(STATIC_DIR, "index.html")
            if os.path.exists(index_file):
                with open(index_file, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            else:
                self.send_response(404)
                self.end_headers()

    def do_POST(self):
        url = urlparse(self.path)
        path = url.path
        body = self.parse_json_body()
        if body is None:
            return self.send_json(400, {"error": "无效的JSON请求体"})

        if path == "/api/register":
            # 严格仅支持邮箱注册
            email = (body.get("email") or "").strip().lower()
            password = body.get("password") or ""
            name = (body.get("name") or "").strip()
            academic_interest = (body.get("academic_interest") or "线性代数与学术研讨").strip()
            affiliation = (body.get("affiliation") or "学术研讨成员").strip()
            bio = (body.get("bio") or "专注于学术研讨，推动共同进步。").strip()

            if not email or "@" not in email or "." not in email:
                return self.send_json(400, {"error": "请输入有效的电子邮箱地址（仅支持邮箱注册）"})
            if len(password) < 6:
                return self.send_json(400, {"error": "密码长度至少需要6位字符"})
            if not name:
                name = email.split("@")[0]

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
            if cursor.fetchone():
                conn.close()
                return self.send_json(400, {"error": "该邮箱已被注册，请直接登录"})

            salt = secrets.token_hex(8)
            pwd_hash = hash_password(password, salt)
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            cursor.execute("""
            INSERT INTO users (email, password_hash, name, role, academic_interest, affiliation, bio, status, created_at)
            VALUES (?, ?, ?, 'member', ?, ?, ?, 'active', ?)
            """, (email, f"{salt}:{pwd_hash}", name, academic_interest, affiliation, bio, now_str))
            user_id = cursor.lastrowid
            conn.commit()
            conn.close()

            # Automatically login
            token = secrets.token_hex(24)
            user_data = {
                "id": user_id,
                "email": email,
                "name": name,
                "role": "member",
                "academic_interest": academic_interest,
                "affiliation": affiliation,
                "bio": bio,
                "status": "active",
                "created_at": now_str
            }
            SESSIONS[token] = user_data

            return self.send_json(200, {
                "message": "注册成功！欢迎加入‘Y性代数·不止Y数’社团！",
                "token": token,
                "user": user_data
            })

        elif path == "/api/login":
            email = (body.get("email") or "").strip().lower()
            password = body.get("password") or ""

            if not email or not password:
                return self.send_json(400, {"error": "请提供邮箱和密码（仅支持邮箱登录）"})

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            row = cursor.fetchone()
            conn.close()

            if not row or not verify_password(row["password_hash"], password):
                return self.send_json(401, {"error": "邮箱或密码错误，请核对后重试"})

            if row["status"] == "inactive":
                return self.send_json(403, {"error": "账号已被停用，请联系信息库管理员"})

            token = secrets.token_hex(24)
            user_data = {
                "id": row["id"],
                "email": row["email"],
                "name": row["name"],
                "role": row["role"],
                "academic_interest": row["academic_interest"],
                "affiliation": row["affiliation"],
                "bio": row["bio"],
                "status": row["status"],
                "created_at": row["created_at"]
            }
            SESSIONS[token] = user_data

            return self.send_json(200, {
                "message": "登录成功！",
                "token": token,
                "user": user_data
            })

        elif path == "/api/logout":
            auth_header = self.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:].strip()
                if token in SESSIONS:
                    del SESSIONS[token]
            return self.send_json(200, {"message": "已安全退出登录"})

        elif path == "/api/admin/members/add":
            current_user = self.get_current_user()
            if not current_user or current_user.get("role") != "admin":
                return self.send_json(403, {"error": "权限不足：需要信息库管理员权限"})

            email = (body.get("email") or "").strip().lower()
            name = (body.get("name") or "").strip()
            role = body.get("role", "member")
            academic_interest = (body.get("academic_interest") or "线性代数研讨").strip()
            affiliation = (body.get("affiliation") or "学术骨干").strip()
            password = body.get("password") or "Member@2026"

            if not email or "@" not in email:
                return self.send_json(400, {"error": "添加失败：邮箱格式不正确"})
            if not name:
                name = email.split("@")[0]

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
            if cursor.fetchone():
                conn.close()
                return self.send_json(400, {"error": "该邮箱成员已在信息库中"})

            salt = secrets.token_hex(8)
            pwd_hash = hash_password(password, salt)
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            cursor.execute("""
            INSERT INTO users (email, password_hash, name, role, academic_interest, affiliation, bio, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
            """, (email, f"{salt}:{pwd_hash}", name, role, academic_interest, affiliation, "社团学术研讨核心成员", now_str))
            user_id = cursor.lastrowid
            conn.commit()
            conn.close()

            return self.send_json(200, {
                "message": f"成功录入成员：{name} ({email})",
                "member": {
                    "id": user_id,
                    "email": email,
                    "name": name,
                    "role": role,
                    "academic_interest": academic_interest,
                    "affiliation": affiliation,
                    "status": "active",
                    "created_at": now_str
                }
            })

        elif path == "/api/admin/members/remove":
            current_user = self.get_current_user()
            if not current_user or current_user.get("role") != "admin":
                return self.send_json(403, {"error": "权限不足：需要信息库管理员权限"})

            member_id = body.get("id")
            if not member_id:
                return self.send_json(400, {"error": "缺少成员ID"})

            if int(member_id) == current_user.get("id"):
                return self.send_json(400, {"error": "无法移除当前登录的管理员自身账号"})

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT email, role FROM users WHERE id = ?", (member_id,))
            row = cursor.fetchone()
            if not row:
                conn.close()
                return self.send_json(404, {"error": "未找到该成员"})

            cursor.execute("DELETE FROM users WHERE id = ?", (member_id,))
            conn.commit()
            conn.close()

            to_del = [tok for tok, u in SESSIONS.items() if u.get("id") == int(member_id)]
            for tok in to_del:
                del SESSIONS[tok]

            return self.send_json(200, {"message": f"已成功从信息库中移除成员 (ID: {member_id})"})

        elif path == "/api/admin/members/toggle-role":
            current_user = self.get_current_user()
            if not current_user or current_user.get("role") != "admin":
                return self.send_json(403, {"error": "权限不足：需要信息库管理员权限"})

            member_id = body.get("id")
            new_role = body.get("role")
            if not member_id or new_role not in ["admin", "member"]:
                return self.send_json(400, {"error": "参数无效"})

            if int(member_id) == current_user.get("id") and new_role != "admin":
                return self.send_json(400, {"error": "不能取消自身管理员权限"})

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET role = ? WHERE id = ?", (new_role, member_id))
            conn.commit()
            conn.close()

            for tok, u in SESSIONS.items():
                if u.get("id") == int(member_id):
                    u["role"] = new_role

            return self.send_json(200, {"message": f"已更新权限为：{new_role}"})

        elif path == "/api/admin/members/toggle-status":
            current_user = self.get_current_user()
            if not current_user or current_user.get("role") != "admin":
                return self.send_json(403, {"error": "权限不足：需要信息库管理员权限"})

            member_id = body.get("id")
            status = body.get("status")
            if not member_id or status not in ["active", "inactive"]:
                return self.send_json(400, {"error": "参数无效"})

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET status = ? WHERE id = ?", (status, member_id))
            conn.commit()
            conn.close()

            return self.send_json(200, {"message": f"状态已更新为：{status}"})

        else:
            return self.send_json(404, {"error": "API端点不存在"})

def main():
    os.makedirs(STATIC_DIR, exist_ok=True)
    init_db()
    server_address = ('0.0.0.0', PORT)
    httpd = HTTPServer(server_address, AppRequestHandler)
    print(f"🚀 Y性代数·不止Y数 门户服务已启动在端口 http://0.0.0.0:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n正在停止服务...")
        httpd.server_close()

if __name__ == "__main__":
    main()
