// import { Stats } from "fs";

export interface ReadFileOptions {
    encoding?: string;
}

export interface PathStat{ // Stats
  isDirectory: boolean,
  isFile: boolean,
  handle: FileSystemHandle | FileSystemDirectoryHandle | null
  ctimeMs: number,
  mtimeMs: number,
  pathArray: string[],
}

export async function verifyPermission(fileHandle: FileSystemHandle | null, mode?: FileSystemPermissionMode,) {
    if(!fileHandle){
        return null;
    }
    const options: FileSystemHandlePermissionDescriptor = {
        mode,
    };
    // Check if permission was already granted. If so, return true.
    if ((await fileHandle.queryPermission(options)) === "granted") {
        return true;
    }

    let request = null;
    try{
        request = await fileHandle.requestPermission(options);
        // Request permission. If the user grants permission, return true.
    }catch (e) {
        return null;
    }
    if (request === "granted") {
        return true;
    }
    // The user didn't grant permission, so return false.
    return false;
}

interface Props {
  rootname: string
}
export default class LocalFileSystem {
    private rootDirctoryHandle: FileSystemDirectoryHandle | null;
    private rootname: string;

    constructor(props:Props) {
        this.rootname = props.rootname;
        this.rootDirctoryHandle = null;
    }

    public async setRoot(): Promise<FileSystemDirectoryHandle | null>{
      const directoryHandle = await window.showDirectoryPicker();
      if(!directoryHandle){
        return null;
      }
      this.rootDirctoryHandle = directoryHandle;
      return directoryHandle
    }


    public async getHandleAndPathArray(path: string, mode: FileSystemPermissionMode = "readwrite"): Promise<{handle:FileSystemDirectoryHandle|null, pathArray:string[]}> {
        const pathArr = path.replace(/\/+$/, "").split("/");
        const directoryHandle = this.rootDirctoryHandle;
        const permission = await verifyPermission(directoryHandle, mode);
        if(!permission){
            return {
              handle: null,
              pathArray:[]
            };
        }
      const responsePath = pathArr.slice(1, pathArr.length);
      return {
          handle:directoryHandle,
          pathArray:responsePath
        };
    }

    public async readFile(path: string, opts: ReadFileOptions = { encoding: "utf-8" }): Promise<string | Uint8Array> {
        const handleAndPathArray = await this.getHandleAndPathArray(path, "read");
        let directoryHandle  = handleAndPathArray.handle;
        const pathArr = handleAndPathArray.pathArray;
        if (!directoryHandle) {
            throw new Error(`${path} is not valid`);
        } else {
            let i = 0;
            for (; i < pathArr.length - 1; i++) {
                directoryHandle = await directoryHandle.getDirectoryHandle(pathArr[i]);
            }
            const file = await (
                await directoryHandle.getFileHandle(pathArr[i])
            ).getFile();
            if (opts.encoding && opts.encoding.match(/^utf-?8$/i)) {
                return file.text();
            } else {
                return new Uint8Array(await file.arrayBuffer());
            }
        }
    }

    public async writeFile(path: string, data: string,keepExistingData=false): Promise<File> {
        const result = await this.getHandleAndPathArray(path, "readwrite");
        let directoryHandle = result.handle;
        const pathArr = result.pathArray;
        if (!directoryHandle) {
            throw new Error(`${path} is not valid`);
        } else {
          let i = 0;
          for (; i < pathArr.length - 1; i++) {
            directoryHandle = await directoryHandle.getDirectoryHandle(pathArr[i], {
              create: true,
            });
          }
          const fileHandle = await directoryHandle.getFileHandle(pathArr[i], {
            create: true,
          });
          // https://wicg.github.io/file-system-access/#api-filesystemfilehandle-createwritable
          const writable = await fileHandle.createWritable({keepExistingData});
          await writable.write(data);
          await writable.close();

          const fileinfo = await fileHandle.getFile()
          return fileinfo
        }
    }

    public async readdir(path: string): Promise<string[]> {
        const result = await this.getHandleAndPathArray(path, "read");
        let directoryHandle = result.handle;
        const pathArr = result.pathArray;
        if (!directoryHandle) {
            throw new Error(`${path} is not valid`);
        } else {
            for (let i = 0; i < pathArr.length; i++) {
                directoryHandle = await directoryHandle.getDirectoryHandle(pathArr[i]);
            }
            const names = [];
            for await (const entry of directoryHandle.values()) {
                names.push(entry.name);
            }
            return names;
        }
    }

    public async unlink(path: string): Promise<void> {
        const result = await this.getHandleAndPathArray(path, "readwrite");
        let directoryHandle = result.handle;
        const pathArr = result.pathArray;
        if (!directoryHandle) {
            throw new Error(`${path} is not valid`);
        } else {
            let i = 0;
            for (; i < pathArr.length - 1; i++) {
                directoryHandle = await directoryHandle.getDirectoryHandle(pathArr[i]);
            }
            return await directoryHandle.removeEntry(pathArr[i], { recursive: true });
        }
    }

    public async stats(path: string): Promise<PathStat> {
        const result = await this.getHandleAndPathArray(path, "read");
        let directoryHandle = result.handle;
        const pathArr = result.pathArray;
        if (!directoryHandle) {
            throw new Error(`${path} is not valid`);
        } else {
            let i = 0;
            for (; i < pathArr.length - 1; i++) {
                directoryHandle = await directoryHandle.getDirectoryHandle(pathArr[i]);
            }
            let fHandle: FileSystemFileHandle | null=null;
            let dHandle: FileSystemDirectoryHandle | null=null;
            try {
                dHandle = await directoryHandle.getDirectoryHandle(pathArr[i]);
            } catch (error) {
                fHandle = await directoryHandle.getFileHandle(pathArr[i]);
            }
            const stats: PathStat = {
                isDirectory: !!dHandle,
                isFile: !!fHandle,
                pathArray: pathArr,
                handle: fHandle || dHandle,
                ctimeMs: fHandle ? (await fHandle.getFile()).lastModified : Date.now(),
                mtimeMs: fHandle ? (await fHandle.getFile()).lastModified : Date.now(),
            };
            return stats;
        }
    }

    public async mkdir(path: string): Promise<FileSystemDirectoryHandle> {
      const result = await this.getHandleAndPathArray(path, "readwrite");
      let directoryHandle = result.handle;
      const pathArr = result.pathArray;
      if (!directoryHandle) {
            throw new Error(`${path} is not valid`);
        } else {
            for (let i = 0; i < pathArr.length; i++) {
                directoryHandle = await directoryHandle.getDirectoryHandle(pathArr[i], {
                    create: true,
                });
            }
            return directoryHandle
        }
    }

    // TODO 待完成，复制目录下的所有文件到另一个文件，
    public copyDir(current: string,newPath: string): void{
        console.log('not support yet', current, newPath)
        // let [directoryHandle, pathArr] = await this.getHandleAndPathArray(path, "readwrite");
        // if (!directoryHandle) {
        //     throw new Error(`${path} is not valid`);
        // } else {
        //     const dirHandle = await directoryHandle.getDirectoryHandle(pathArr[0]);
        //     console.log(pathArr,directoryHandle,'directoryHandle',dirHandle)
        //     return directoryHandle
        // }
    }

    public async exists(path: string): Promise<boolean> {
      const result = await this.getHandleAndPathArray(path, "read");
      let directoryHandle = result.handle;
      const pathArr = result.pathArray;
      if (!directoryHandle) {
            throw new Error(`${path} is not valid`);
        } else {
            let i = 0;
            for (; i < pathArr.length - 1; i++) {
                try {
                    directoryHandle = await directoryHandle.getDirectoryHandle(
                        pathArr[i],
                    );
                } catch (error) {
                    return false;
                }
            }
            try {
                await directoryHandle.getFileHandle(pathArr[i]);
                return true;
            } catch (error) {
                try {
                    await directoryHandle.getDirectoryHandle(pathArr[i]);
                    return true;
                } catch (error) {
                    return false;
                }
            }
        }
    }

    public async rmdir(path: string): Promise<void> {
        const result = await this.getHandleAndPathArray(path, "readwrite");
        let directoryHandle = result.handle;
        const pathArr = result.pathArray;
        if (!directoryHandle) {
            throw new Error(`${path} is not valid`);
        } else {
            let i = 0;
            for (; i < pathArr.length - 1; i++) {
                directoryHandle = await directoryHandle.getDirectoryHandle(pathArr[i]);
            }
            return await directoryHandle.removeEntry(pathArr[i], { recursive: true });
        }
    }

    /**
     * Assuming rename only file but not path
     * @param oldPath
     * @param newPath
     */
    public async rename(oldPath: string, newPath: string): Promise<void> {
        const data = await this.readFile(oldPath, { encoding: "utf-8" }); // Could be buggy for binary file
        await this.writeFile(newPath, data as any);
        await this.unlink(oldPath);
    }
}
