// 首页公告内容（Markdown 格式）
// 支持 en / zh / ja 三语
export const homeAnnouncementMarkdown = {
  en: `# Welcome to yororIce's Town

> 1. There used to be an issue in guest-mode identity handling; tokens could expire too quickly after entering the site as a guest.
**Fixed**

2. Due to network conditions, POST/GET requests may be slow. When posting a moment, please wait for the page to return or close the editor manually. Do not click upload repeatedly to avoid duplicate uploads.

3. Images uploaded to gallery cannot be deleted (contact the admin by email if needed). Images uploaded to gallery via the "commit to gallery" option when posting a moment cannot be removed by deleting that moment.

> 4. Fixed plaintext credential transmission during account login.
> 5. Guest mode can now leave messages in **Guestbook**: if you enter a username it will be used; otherwise a random one is used. Messages cannot be deleted after posting.
> 6. When posting a moment, you can drag and drop image files directly onto the upload area.
> 7. Chinese, Japanese and English language switching is supported.

8. A custom AI bot is connected to the site API; you may sometimes see its moments or comments in the feed.

> 9. **Viewed** count may trigger repeatedly; root cause not found. **Won't fix.**

10. You can view **moments/articles** published on a given date directly from the calendar.

> 11. The website is currently not optimized for small screens. Adaptation will be **considered** once all features/styles are completed.

12. Chat room is now available (beta).
13. Improved page display: guests entering via direct link are no longer forced to redirect to the login page.
14. Improved image display and added article export to Markdown.
15. Improved locale display: the site will automatically select a locale based on the user's region on first visit, with options to change it later in settings.

> 16. Mobile adaptation in progress.
> 17. Planning to add password/username modification features for non-guest users, as well as password reset functionality in the login process.

`,
  zh: `# Welcome to yororIce's Town

> 1. 目前后端对于游客模式的识别存在一定问题，使用游客模式进入网站后token很快就会失效
    **已修复**
    
2. 由于网络问题，POST/GET请求速度慢，在譬如发布moment的POST期间请耐心等待页面回退或自主关闭发布页面，请勿连续点击上传按钮以免重复上传

3. 上传到gallery的图片无法删除（若要删除请通过邮箱联系管理员），发布moment时通过勾选commit上传到gallery的图片同样无法通过删除moment达到移除gallery的目的

> 4. 修复账号登陆时账密明文传输的问题
> 5. 游客模式现在可以在 **GuestBook** 中进行留言, 输入用户名时会使用输入的用户名, 不输入时则随机用户名; 留言后不可删除
> 6. 发布动态时可直接将图片文件拖拽到上传区
> 7. 支持中日英语种切换

8. 自制的ai机器人接入了网站的api, 有时能在动态区里看见它发的动态或者评论

> 9. **viewed** 好像会重复触发, 没找到问题发生点, **拒绝修复**

10. 通过日历可直接查看对应日期发布的 **动态/文章**

> 11. 网站目前未对小屏进行适配, 待功能/样式全部完成后会 **考虑** 适配

12. 初步上线聊天室(测试中)
13. 优化页面展示效果, 游客通过链接直接进入网站时不再强制重定向到登录页面
14. 优化图片展示功能, 增添article导出markdown功能
15. 优化语种显示, 首次进入网站时会根据用户所在地区自动选择语种, 后续可通过设置选项修改语种

> 16. 正在进行移动端适配
> 17. 准备为非游客用户添加修改密码/用户名的功能, 以及 login 中重置密码的功能

`,
  ja: `# Welcome to yororIce's Town

> 1. 以前、ゲストモードの識別に問題があり、ゲストでサイトに入るとトークンがすぐに失効していました。
**修正済み**

2. ネットワークの状況により、POST/GET が遅くなることがあります。moment 投稿中は、ページが戻るまで待つか、手動で編集を閉じてください。二重アップロードを避けるため、アップロードを連打しないでください。

3. gallery にアップロードした画像は削除できません（削除希望は管理者にメールで連絡）。moment 投稿時に「commit to gallery」をオンにしてアップロードした画像も、その moment を削除しても gallery からは消えません。

> 4. アカウントログイン時の認証情報平文送信を修正しました。
> 5. ゲストモードで **GuestBook** に書き込み可能になりました。ユーザー名を入力するとその名前が使われ、未入力の場合はランダムな名前になります。投稿後の削除はできません。
> 6. 動態投稿時に画像ファイルをアップロードエリアへドラッグ＆ドロップできます。
> 7. 中国語・日本語・英語の切り替えに対応しています。

8. 自作の AI ボットがサイト API に接続されており、動態やコメントがたまに表示されることがあります。

> 9. **viewed** が重複してカウントされることがあるが、原因不明のため **修正しない**。

10. カレンダーから指定日の **モーメント/記事** を直接確認できます。

> 11. 現在のところ、ウェブサイトは小さい画面に対応していません。機能やスタイルがすべて完成した後で**対応を検討**します

12. チャットルームをリリースしました（ベータ版）
13. ページ表示を改善し、リンクから直接入ったゲストはログインページへ強制リダイレクトされなくなりました。
14. 画像表示を改善し、記事の Markdown エクスポート機能を追加しました。

> 15. ロケール表示を改善し、初回訪問時にユーザーの地域に基づいてロケールを自動選択するようになりました。後で設定から変更することもできます。
> 16. モバイル対応を進行中。
> 17. 非ゲストユーザー向けにパスワード/ユーザー名変更機能と、ログインプロセスにおけるパスワードリセット機能の追加を予定しています。
`,
};
