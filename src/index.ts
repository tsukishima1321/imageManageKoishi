import { Context, Schema } from 'koishi'
import { join } from 'path';
import { pathToFileURL } from 'url'
let fs = require("fs");
let request = require("request");

function getfileByUrl(url, fileName, dir) {
  let stream = fs.createWriteStream(join(dir, fileName));
  request(url).pipe(stream).on("close", function (err) {
    console.log("图片" + url + "下载完毕");
  });
}

export const name = 'picture-collect'

export interface Config {
  dataDir: string
  pageSize: number
  repoDir: string
}

export const inject = {
  required: ['database'],
  optional: [],
}

export const Config: Schema<Config> = Schema.object({
  dataDir: Schema.string().default("./data/ham"),
  repoDir: Schema.string().default("D:/Z/Pictures"),
  pageSize: Schema.number().default(10)
})

declare module 'koishi' {
  interface Tables {
    pictures: Pic
    types: Type
  }
}

export interface Pic {
  href: string
  description: string
  date: Date
  type: string
}

export interface Type {
  id: number
  typename: string
}

export function apply(ctx: Context, cfg: Config) {
  ctx.model.extend('pictures', {
    href: 'string',
    description: 'string',
    date: 'date',
    type: 'string'
  }, { primary: 'href' })

  ctx.model.extend('types', {
    id: 'unsigned',
    typename: 'string'
  }, { primary: 'id' })

  var pageSize = cfg.pageSize

  try {
    if (!fs.existsSync(cfg.dataDir)) {
      fs.mkdirSync(cfg.dataDir)
    }
  } catch (err) {
    console.error(err)
    console.error("请检查文件权限")
  }

  ctx.command('ham/ham_add <type> <des>').alias("入库")
    .action(async ({ session }, type, des) => {
      if (session.quote) {
        if (session.quote.elements[0].type == "img") {
          var typeList = await ctx.database.get('types',{typename:type},['typename']);
          if(typeList.length==0){
            await ctx.database.create('types',{id:null,typename:type})
          }
          var src: string = session.quote.elements[0].attrs.src
          console.log(src)
          src = JSON.parse(new Buffer(src.split("/")[5], "base64").toString()).md5 + ".jpg"
          console.log(src)
          getfileByUrl(session.quote.elements[0].attrs.src, src, cfg.dataDir)
        }
        var result = await ctx.database.create('pictures', { description: des, date: new Date(), type: type, href: src })
        return '添加成功'
      } else {
        return '没有引用消息'
      }
    })

  ctx.command('ham/ham_select [...rest]').alias("查看")
    .option('tag', '-t')
    .option('list', '-l').option('page', '-p <page:number>').option('full', '-f')
    .action(async ({ session, options }, ...rest) => {
      var query = ctx.database.select('pictures')
      var finds: Pic[]
      for (var i = 0; i < rest.length; i++) {
        query.where({ description: { $regex: rest[i] } })
      }
      if (options.list) {
        if (!options.full) {
          var page: number
          if (!options.page) {
            page = 1
          } else {
            page = options.page
          }
          query.orderBy('date', 'desc').limit(pageSize).offset(page * pageSize - pageSize)
        }
      }
      finds = await query.execute()
      if (finds.length == 0) {
        return "没有找到"
      }
      if (!options.list) {
        const find = finds[Math.floor(Math.random() * finds.length)]
        const href = pathToFileURL(join(cfg.repoDir, find.href))
        const res = `<img src="${href}">`
        return res
      } else {
        var res: string = ""
        for (var i = 0; i < finds.length; i++) {
          const y = finds[i]
          res += y.type + ":  " + y.description + "\n"
        }
        if (i == pageSize && page) {
          res += "第" + String(page) + "页"
        }
        return res
      }
    })
}
