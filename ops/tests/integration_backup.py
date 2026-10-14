"""Real PostgreSQL/vector + restic restore drill using disposable Docker resources.
Run after: docker build -t tasteinsight-ops-backup:test ops/backup
"""
import json
from pathlib import Path
import subprocess
import time
import uuid

PREFIX = "ti-ops-test-" + uuid.uuid4().hex[:10]
IMAGE = "tasteinsight-ops-backup:test"
containers, volumes = [], []

def docker(*args, input=None, check=True):
    result = subprocess.run(["docker", *args], input=input, text=True, capture_output=True, timeout=300)
    if check and result.returncode:
        raise RuntimeError(f"docker {args[0]} failed: {result.stderr[-1500:]}")
    return result

def volume(suffix):
    name = PREFIX + "-" + suffix
    docker("volume", "create", "--label", "tasteinsight.test="+PREFIX, name)
    volumes.append(name)
    return name

def db(suffix):
    name = PREFIX + "-" + suffix
    containers.append(name)
    docker("run", "-d", "--name", name, "--network", PREFIX, "--label", "tasteinsight.test="+PREFIX,
           "-v", volume(suffix+"-data")+":/var/lib/postgresql/data",
           "-e", "POSTGRES_PASSWORD=test-only", "-e", "POSTGRES_USER=test", "-e", "POSTGRES_DB=test",
           "pgvector/pgvector:pg15")
    for _ in range(60):
        if docker("exec", name, "pg_isready", "-U", "test", check=False).returncode == 0: return name
        time.sleep(1)
    raise RuntimeError("Test database did not start")

def query(container, sql):
    return docker("exec", "-i", container, "psql", "-U", "test", "-d", "test", "-v", "ON_ERROR_STOP=1", "-At", input=sql).stdout.strip()

def operate(host, work, uploads, command, extra=None, check=True):
    env = {"PGHOST":host,"PGDATABASE":"test","PGUSER":"test","PGPASSWORD":"test-only",
           "RESTIC_REPOSITORY":"/repo","RESTIC_PASSWORD":"encrypted-test-only","BACKUP_HOST":PREFIX,
           **(extra or {})}
    args = ["run","--rm","--network",PREFIX,"-v",repo+":/repo","-v",work+":/work","-v",metrics+":/metrics"]
    args += ["-v",uploads+(":/restored-uploads" if command=="restore" else ":/uploads:ro")]
    for key,value in env.items():args += ["-e",key+"="+value]
    return docker(*args,IMAGE,command,check=check)

try:
    docker("network","create","--label","tasteinsight.test="+PREFIX,PREFIX)
    repo, work, uploads, metrics = [volume(x) for x in ("repo","work","uploads","metrics")]
    restored, restore_work = volume("restored"), volume("restore-work")
    source, target = db("source"), db("target")
    query(source, '''CREATE EXTENSION vector;
CREATE TABLE "User" (id int PRIMARY KEY, name text NOT NULL);
CREATE TABLE "Review" (id int PRIMARY KEY, user_id int REFERENCES "User", embedding vector(3));
INSERT INTO "User" VALUES (1,'测试用户');
INSERT INTO "Review" VALUES (1,1,'[1,2,3]');''')
    docker("run","--rm","-v",uploads+":/uploads","--entrypoint","sh",IMAGE,"-c","printf 'test image content' > /uploads/image.txt")
    operate(source,work,uploads,"init")
    operate(source,work,uploads,"once")
    snapshots=json.loads(operate(source,work,uploads,"list").stdout)
    snapshot=snapshots[-1]["id"]
    operate(source,work,uploads,"check")
    query(source, '''INSERT INTO "User" VALUES (2,'备份之后');''')
    result=operate(target,restore_work,restored,"restore",{"RESTORE_SNAPSHOT":snapshot})
    report=json.loads(result.stdout.strip().splitlines()[-1])
    assert report["tables"]["User"] == 1 and report["tables"]["Review"] == 1, report
    assert query(target, 'SELECT embedding::text FROM "Review"') == '[1,2,3]'
    assert docker("run","--rm","-v",restored+":/uploads:ro","--entrypoint","cat",IMAGE,"/uploads/image.txt").stdout == "test image content"
    assert operate(target,restore_work,restored,"restore",{"RESTORE_SNAPSHOT":snapshot},check=False).returncode != 0
    assert query(source,'SELECT count(*) FROM "User"') == '2'
    empty_files, empty_work = volume("empty-files"), volume("empty-work")
    failure=operate(target,empty_work,empty_files,"restore",{"RESTORE_SNAPSHOT":snapshot},check=False)
    assert failure.returncode != 0 and "database must be empty" in failure.stderr
    before=docker("run","--rm","-v",metrics+":/metrics:ro","--entrypoint","cat",IMAGE,"/metrics/state.json").stdout
    assert operate(source,work,uploads,"once",{"RESTIC_PASSWORD":"wrong-password"},check=False).returncode != 0
    after=json.loads(docker("run","--rm","-v",metrics+":/metrics:ro","--entrypoint","cat",IMAGE,"/metrics/state.json").stdout)
    assert after["last_success_timestamp_seconds"] == json.loads(before)["last_success_timestamp_seconds"]
    assert after["last_run_success"] == 0
    print(json.dumps({"result":"PASS","checks":["encrypted backup","full repository verification","PostgreSQL rows + FK + vector restore","upload restore","existing files refusal","existing database refusal","failed backup preserves success timestamp","source unchanged by restore"]}))
finally:
    for name in containers:docker("rm","-f",name,check=False)
    for name in volumes:docker("volume","rm",name,check=False)
    docker("network","rm",PREFIX,check=False)
