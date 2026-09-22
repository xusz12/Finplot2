from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
S=2
im=Image.new('RGB',(1200*S,1020*S),'#f5f5f7');d=ImageDraw.Draw(im)
font=str(next(Path('/System/Library/AssetsV2/com_apple_MobileAsset_Font8').glob('*/AssetData/PingFang.ttc'), Path('/System/Library/Fonts/STHeiti Light.ttc')))
def text(x,y,t,size=18,color='#1d1d1f'):
 d.text((x*S,y*S),t,font=ImageFont.truetype(font,size*S),fill=color)
def box(x,y,w,h,fill,r=12,outline=None):
 d.rounded_rectangle((x*S,y*S,(x+w)*S,(y+h)*S),r*S,fill=fill,outline=outline,width=S)
def line(coords,color='#d8d8de',width=1):d.line([(x*S,y*S) for x,y in coords],fill=color,width=width*S)
def arrow(x,y,right=False,color='#777780'):
 a=1 if right else -1;line([(x-a*3,y-6),(x+a*3,y),(x-a*3,y+6)],color,2)
def down(x,y):line([(x-4,y-2),(x,y+2),(x+4,y-2)],'#777780',2)
def control(x,y,year=False,opened=False):
 box(x,y,144,44,'#eaeaec',11);box(x+(74 if year else 3),y+3,67,38,'#ffffff',9)
 text(x+20,y+10,'月度',16,'#777780' if year else '#1d1d1f');text(x+91,y+10,'年度',16,'#1d1d1f' if year else '#777780')
 arrow(x+178,y+22)
 if opened:box(x+196,y,170,44,'#e8f1ff',9)
 text(x+(230 if year else 207),y+9,'2026年' if year else '2026年9月',18,'#007aff' if opened else '#1d1d1f')
 arrow(x+392,y+22,True)
text(56,36,'Finplot',19)
text(56,78,'让时间选择，轻一点。',34)
text(57,132,'直接翻月，也能从容回看一整年。',18,'#777780')
text(57,205,'01  月度浏览',16,'#777780');text(637,205,'02  年度浏览',16,'#777780')
box(56,247,528,153,'#ffffff',18);box(616,247,528,153,'#ffffff',18)
control(90,278)
control(650,278,True)
text(90,346,'左右切换月份，点击日期快速跳转',15,'#777780');text(650,346,'切换年度后，只显示年份',15,'#777780')
text(57,452,'03  展开月份选择',16,'#777780')
box(56,492,1088,466,'#eeeeF1',18)
control(90,523,opened=True)
# popup below date trigger
box(284,579,326,339,'#e2e2e8',16)
box(283,576,326,339,'#ffffff',16)
text(307,598,'2026年',19);arrow(542,614);arrow(581,614,True)
for i in range(12):
 col=i%4;row=i//4;x=299+col*75;y=651+row*63
 if i==8:box(x,y,66,46,'#007aff',10)
 text(x+(20 if i<9 else 15),y+10,f'{i+1}月',17,'#ffffff' if i==8 else '#34343a')
line([(303,851),(589,851)],'#eeeeF1')
text(410,870,'回到本月',16,'#007aff')
text(693,642,'常用操作，一步就到',23)
text(693,698,'‹  ›    查看上一个或下一个周期',17,'#666670')
text(693,743,'日期   展开选择，快速跨月跨年',17,'#666670')
text(693,788,'蓝色   明确标记当前选中的月份',17,'#666670')
text(57,978,'交互概念稿  ·  月度 / 年度 / 月份面板',13,'#8b8b93')
im.save('output/design/period-picker-concept.png')
